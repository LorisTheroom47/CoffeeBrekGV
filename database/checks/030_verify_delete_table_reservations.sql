-- Coffee Break GV
-- Controlli di sola lettura per la cancellazione Admin delle prenotazioni.
-- Non invoca la RPC e non modifica dati, policy o privilegi.

-- Attese: una sola funzione con firma uuid, owner postgres, PL/pgSQL,
-- VOLATILE, SECURITY DEFINER, ritorno text e search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.provolatile = 'v' as is_volatile,
  pg_catalog.pg_get_function_result(routine.oid) = 'text' as returns_text,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where schema_name.nspname = 'public'
  and routine.proname = 'delete_table_reservation'
  and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid';

-- Attesa: delete_table_reservation_function_count = 1.
select pg_catalog.count(*) as delete_table_reservation_function_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'public'
  and routine.proname = 'delete_table_reservation';

-- Attese: accesso esclusivamente Admin, DELETE filtrato per UUID, risultati
-- controllati, nessun SQL dinamico e nessun accesso order_operator.
with rpc_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where schema_name.nspname = 'public'
    and routine.proname = 'delete_table_reservation'
    and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid'
)
select
  source_code ilike '%private.is_admin()%'
    as checks_admin_access,
  source_code not ilike '%can_manage_orders%'
    and source_code not ilike '%order_operators%'
    as excludes_order_operator_access,
  source_code ilike '%delete from public.table_reservations%'
    as deletes_reservations_only,
  source_code ilike '%target_reservation.id = p_reservation_id%'
    as filters_exact_reservation_id,
  source_code ilike '%invalid_id%' as returns_invalid_id,
  source_code ilike '%not_found%' as returns_not_found,
  source_code ilike '%access_denied%' as returns_access_denied,
  source_code ilike '%deleted%' as returns_deleted,
  source_code !~* '\mexecute\M' as no_dynamic_sql
from rpc_definition;

-- Attese: PUBLIC false, anon false, authenticated true. Gli utenti
-- authenticated non Admin vengono respinti dal controllo private.is_admin().
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where schema_name.nspname = 'public'
    and routine.proname = 'delete_table_reservation'
    and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid'
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where privilege.specific_schema = 'public'
      and privilege.routine_name = 'delete_table_reservation'
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_execute_revoked,
  not pg_catalog.has_function_privilege(
    'anon', target_function.oid, 'EXECUTE'
  ) as anon_execute_revoked,
  pg_catalog.has_function_privilege(
    'authenticated', target_function.oid, 'EXECUTE'
  ) as authenticated_can_execute
from target_function;

-- Atteso: zero privilegi DELETE diretti per PUBLIC, anon e authenticated.
select pg_catalog.count(*) as public_client_direct_delete_privilege_count
from information_schema.role_table_grants as privilege
where privilege.table_schema = 'public'
  and privilege.table_name = 'table_reservations'
  and privilege.grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege.privilege_type = 'DELETE';

-- Atteso: zero policy DELETE/ALL sulla tabella. La cancellazione passa
-- esclusivamente dalla RPC controllata.
select pg_catalog.count(*) as direct_delete_policy_count
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'table_reservations'
  and policy.cmd in ('DELETE', 'ALL');
