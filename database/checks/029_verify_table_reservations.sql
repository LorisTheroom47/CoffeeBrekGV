-- Coffee Break GV
-- Controlli di sola lettura per la prima versione delle prenotazioni tavoli.
-- Non invoca la RPC e non modifica dati, policy o privilegi.

-- Attesa: una tabella con RLS e FORCE RLS attive.
select
  table_definition.relrowsecurity as rls_enabled,
  table_definition.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as table_definition
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_definition.relnamespace
where schema_name.nspname = 'public'
  and table_definition.relname = 'table_reservations';

-- Attesa: 12 colonne, tutte con i tipi previsti.
select
  column_definition.column_name,
  column_definition.data_type,
  column_definition.is_nullable,
  column_definition.column_default
from information_schema.columns as column_definition
where column_definition.table_schema = 'public'
  and column_definition.table_name = 'table_reservations'
order by column_definition.ordinal_position;

-- Attese: tutti true. Non deve esserci alcuna unicità su data/ora.
with constraints as (
  select
    constraint_definition.conname,
    pg_catalog.pg_get_constraintdef(constraint_definition.oid) as definition
  from pg_catalog.pg_constraint as constraint_definition
  where constraint_definition.conrelid =
    'public.table_reservations'::pg_catalog.regclass
)
select
  pg_catalog.bool_or(definition ilike '%party_size between 1 and 8%')
    as party_size_is_limited,
  pg_catalog.bool_or(
    definition ilike '%reservation_time%12:00:00%14:00:00%'
    and definition ilike '%15%'
  ) as reservation_slots_are_limited,
  pg_catalog.bool_or(definition ilike '%status = %confirmed%')
    as status_is_confirmed_only,
  pg_catalog.bool_or(definition ilike '%request_fingerprint%[0-9a-f]{64}%')
    as fingerprint_format_is_checked,
  not pg_catalog.bool_or(
    (definition ilike 'UNIQUE%')
    and definition ilike '%reservation_date%'
    and definition ilike '%reservation_time%'
  ) as no_capacity_or_slot_uniqueness
from constraints;

-- Attese: una sola policy SELECT, authenticated, admin-only.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual ilike '%private.is_admin()%'
    as uses_is_admin
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'table_reservations';

-- Attesa: zero policy che autorizzano gli operatori ordini.
select pg_catalog.count(*) as order_operator_policy_count
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'table_reservations'
  and concat_ws(' ', policy.qual, policy.with_check)
    ~* '(order_operators|can_manage_orders)';

-- Attesi: zero privilegi diretti di scrittura per PUBLIC/anon/authenticated.
select pg_catalog.count(*) as public_client_write_privilege_count
from information_schema.role_table_grants as privilege
where privilege.table_schema = 'public'
  and privilege.table_name = 'table_reservations'
  and privilege.grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege.privilege_type in (
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  );

-- Attese: authenticated può leggere la tabella; anon e PUBLIC no.
select
  pg_catalog.has_table_privilege(
    'authenticated', 'public.table_reservations', 'SELECT'
  ) as authenticated_has_select,
  not pg_catalog.has_table_privilege(
    'anon', 'public.table_reservations', 'SELECT'
  ) as anon_select_revoked;

-- Attese: una sola funzione con firma prevista, owner postgres, PL/pgSQL,
-- VOLATILE, SECURITY DEFINER, search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.provolatile = 'v' as is_volatile,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where schema_name.nspname = 'public'
  and routine.proname = 'create_public_table_reservation'
  and pg_catalog.oidvectortypes(routine.proargtypes)
    = 'text, text, integer, date, time without time zone, uuid, text, text';

-- Attesa: reservation_rpc_count = 1, quindi nessun overload alternativo.
select pg_catalog.count(*) as reservation_rpc_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'public'
  and routine.proname = 'create_public_table_reservation';

-- Attese: validazioni, ora locale, idempotenza e INSERT controllato presenti;
-- nessun SQL dinamico e nessun riferimento agli ordini pranzo.
with rpc_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where schema_name.nspname = 'public'
    and routine.proname = 'create_public_table_reservation'
)
select
  source_code ilike '%Europe/Rome%' as uses_rome_time,
  source_code ilike '%p_party_size not between 1 and 8%'
    as validates_party_size,
  source_code ilike '%12:00:00%'
    and source_code ilike '%14:00:00%'
    and source_code ilike '%15%'
    as validates_time_slots,
  source_code ilike '%RESERVATION_TIME_PASSED%'
    as rejects_passed_same_day_slots,
  source_code ilike '%pg_advisory_xact_lock%'
    as uses_advisory_lock,
  source_code ilike '%IDEMPOTENCY_CONFLICT%'
    as detects_idempotency_conflict,
  source_code ilike '%insert into public.table_reservations%'
    as inserts_reservation,
  source_code !~* '\mexecute\M' as no_dynamic_sql,
  source_code not ilike '%public.orders%'
    and source_code not ilike '%public.order_items%'
    as separate_from_orders
from rpc_definition;

-- Attese: service_role true; PUBLIC, anon e authenticated false.
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where schema_name.nspname = 'public'
    and routine.proname = 'create_public_table_reservation'
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where privilege.specific_schema = 'public'
      and privilege.routine_name = 'create_public_table_reservation'
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_execute_revoked,
  not pg_catalog.has_function_privilege(
    'anon', target_function.oid, 'EXECUTE'
  ) as anon_execute_revoked,
  not pg_catalog.has_function_privilege(
    'authenticated', target_function.oid, 'EXECUTE'
  ) as authenticated_execute_revoked,
  pg_catalog.has_function_privilege(
    'service_role', target_function.oid, 'EXECUTE'
  ) as service_role_can_execute
from target_function;
