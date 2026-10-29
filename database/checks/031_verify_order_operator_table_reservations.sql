-- Coffee Break GV
-- Verifiche read-only: gestione prenotazioni Admin e order_operator.

-- Attese: helper unico, owner postgres, STABLE, SECURITY DEFINER,
-- search_path vuoto e controllo dei soli ruoli previsti.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  routine.prosecdef as security_definer,
  routine.provolatile = 's' as is_stable,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty,
  routine.prosrc ilike '%private.is_admin()%' as checks_admin,
  routine.prosrc ilike '%private.is_order_operator()%' as checks_order_operator,
  routine.prosrc !~* '\mexecute\M' as no_dynamic_sql
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'private'
  and routine.proname = 'can_manage_reservations'
  and pg_catalog.oidvectortypes(routine.proargtypes) = '';

-- Attesa: private.is_order_operator() proviene dalla migrazione 017 e
-- identifica il ristoratore tramite auth.uid() in public.order_operators.
select
  pg_catalog.count(*) = 1 as is_order_operator_function_exists,
  pg_catalog.bool_and(routine.prosecdef) as security_definer,
  pg_catalog.bool_and(routine.provolatile = 's') as is_stable,
  pg_catalog.bool_and(
    coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
      = 'search_path=""'
  ) as search_path_is_empty,
  pg_catalog.bool_and(
    routine.prosrc ilike '%from public.order_operators%'
    and routine.prosrc ilike '%auth.uid()%'
  ) as identifies_current_order_operator
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'private'
  and routine.proname = 'is_order_operator'
  and pg_catalog.oidvectortypes(routine.proargtypes) = '';

-- Attesa: una sola policy SELECT, authenticated, basata sull'helper.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual ilike '%can_manage_reservations%' as uses_expected_helper
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'table_reservations';

-- Attese: RLS e FORCE RLS entrambe attive.
select
  target.relrowsecurity as rls_enabled,
  target.relforcerowsecurity as force_rls_enabled
from pg_catalog.pg_class as target
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = target.relnamespace
where schema_name.nspname = 'public'
  and target.relname = 'table_reservations';

-- Attese: una funzione delete(uuid) e una update con la firma prevista.
select
  routine.proname,
  pg_catalog.oidvectortypes(routine.proargtypes) as argument_types,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  routine.prosecdef as security_definer,
  routine.provolatile = 'v' as is_volatile,
  pg_catalog.pg_get_function_result(routine.oid) = 'text' as returns_text,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'public'
  and (
    (
      routine.proname = 'delete_table_reservation'
      and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid'
    )
    or (
      routine.proname = 'update_table_reservation'
      and pg_catalog.oidvectortypes(routine.proargtypes)
        = 'uuid, text, text, integer, date, time without time zone, text'
    )
  )
order by routine.proname;

-- Attese: entrambe controllano can_manage_reservations, agiscono per UUID,
-- non usano SQL dinamico e restituiscono esiti controllati.
select
  routine.proname,
  routine.prosrc ilike '%private.can_manage_reservations()%'
    as checks_manager_access,
  routine.prosrc ilike '%target_reservation.id = p_reservation_id%'
    as filters_exact_reservation_id,
  routine.prosrc ilike '%access_denied%' as returns_access_denied,
  routine.prosrc ilike '%not_found%' as returns_not_found,
  routine.prosrc !~* '\mexecute\M' as no_dynamic_sql
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'public'
  and routine.proname in (
    'delete_table_reservation',
    'update_table_reservation'
  );

-- Attese per update: campi consentiti, slot esatti, Europe/Rome e nessuna
-- modifica a stato, idempotenza o numero prenotazione. La riga viene bloccata
-- e data/orario passati sono ammessi soltanto quando restano invariati.
with update_rpc as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where schema_name.nspname = 'public'
    and routine.proname = 'update_table_reservation'
    and pg_catalog.oidvectortypes(routine.proargtypes)
      = 'uuid, text, text, integer, date, time without time zone, text'
)
select
  source_code ilike '%customer_name = v_customer_name%'
    and source_code ilike '%customer_phone = v_customer_phone%'
    and source_code ilike '%party_size = p_party_size%'
    and source_code ilike '%reservation_date = p_reservation_date%'
    and source_code ilike '%reservation_time = p_reservation_time%'
    and source_code ilike '%customer_notes = v_customer_notes%'
      as updates_only_expected_business_fields,
  source_code ilike '%Europe/Rome%' as validates_rome_time,
  source_code ilike '%12:00:00%'
    and source_code ilike '%14:00:00%'
    and source_code ilike '%13:45:00%'
      as validates_reservation_slots,
  source_code ilike '%for update%' as locks_target_reservation,
  source_code ilike '%v_existing_reservation_date%'
    and source_code ilike '%v_existing_reservation_time%'
    and source_code ilike '%is distinct from%'
      as distinguishes_schedule_changes,
  source_code ilike '%p_reservation_date < v_today%'
    and source_code ilike '%p_reservation_time <= v_current_time%'
      as rejects_past_schedule_targets,
  source_code not ilike '%status =%'
    and source_code not ilike '%idempotency_key =%'
    and source_code not ilike '%reservation_number =%'
      as preserves_protected_fields,
  source_code ilike '%invalid_data%' as returns_invalid_data
from update_rpc;

-- Atteso: PUBLIC e anon non possono eseguire; authenticated può invocare,
-- ma le RPC applicano il controllo ruolo interno.
select
  routine.proname,
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where privilege.specific_schema = 'public'
      and privilege.routine_name = routine.proname
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_execute_revoked,
  not pg_catalog.has_function_privilege(
    'anon', routine.oid, 'EXECUTE'
  ) as anon_execute_revoked,
  pg_catalog.has_function_privilege(
    'authenticated', routine.oid, 'EXECUTE'
  ) as authenticated_can_execute
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'public'
  and routine.proname in (
    'delete_table_reservation',
    'update_table_reservation'
  );

-- Attesi: zero privilegi diretti UPDATE/DELETE e zero policy corrispondenti.
select pg_catalog.count(*) as direct_write_privilege_count
from information_schema.role_table_grants as privilege
where privilege.table_schema = 'public'
  and privilege.table_name = 'table_reservations'
  and privilege.grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege.privilege_type in ('UPDATE', 'DELETE');

select pg_catalog.count(*) as direct_write_policy_count
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'table_reservations'
  and policy.cmd in ('UPDATE', 'DELETE', 'ALL');
