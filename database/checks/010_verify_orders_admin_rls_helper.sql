-- Coffee Break Monza
-- Controlli di sola lettura per private.is_admin() e orders_select_admin.
-- Non invoca la funzione e non modifica dati, policy o privilegi.

-- Attese: una funzione, owner postgres, SQL, SECURITY DEFINER, STABLE,
-- nessun parametro, ritorno boolean e search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  case routine.provolatile
    when 'v' then 'volatile'
    when 's' then 'stable'
    when 'i' then 'immutable'
  end as volatility,
  routine.pronargs as argument_count,
  pg_catalog.pg_get_function_result(routine.oid) as result_type,
  routine.proconfig as function_configuration,
  coalesce(
    pg_catalog.array_to_string(routine.proconfig, ','),
    ''
  ) = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  schema_name.nspname = 'private'
  and routine.proname = 'is_admin'
  and routine.prokind = 'f';

-- Attesa: function_count = 1.
select pg_catalog.count(*) as function_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where
  schema_name.nspname = 'private'
  and routine.proname = 'is_admin'
  and routine.prokind = 'f'
  and routine.pronargs = 0
  and routine.prorettype = 'pg_catalog.bool'::pg_catalog.regtype;

-- Attese: tutti true. La funzione usa soltanto auth.uid() e admin_users,
-- senza auth.users, service_role, SQL dinamico o concatenazione di query.
with function_definition as (
  select
    routine.prosrc as source_code,
    pg_catalog.pg_get_functiondef(routine.oid) as definition
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'private'
    and routine.proname = 'is_admin'
    and routine.prokind = 'f'
    and routine.pronargs = 0
)
select
  source_code ilike '%auth.uid()%' as auth_uid_is_used,
  source_code ilike '%public.admin_users%' as admin_users_is_qualified,
  source_code not ilike '%auth.users%' as no_auth_users_reference,
  definition not ilike '%service_role%' as no_service_role_reference,
  source_code !~* '\mexecute\M' as no_dynamic_execute,
  source_code not ilike '%format(%' as no_format_query,
  source_code not ilike '%||%' as no_query_concatenation
from function_definition;

-- Attese: PUBLIC = false, anon = false, authenticated = true.
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'private'
    and routine.proname = 'is_admin'
    and routine.prokind = 'f'
    and routine.pronargs = 0
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'private'
      and privilege.routine_name = 'is_admin'
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

-- Attese: authenticated ha soltanto USAGE e non CREATE sullo schema private;
-- anon non ha USAGE né CREATE.
select
  pg_catalog.has_schema_privilege(
    'authenticated', schema_name.oid, 'USAGE'
  ) as authenticated_has_usage,
  not pg_catalog.has_schema_privilege(
    'authenticated', schema_name.oid, 'CREATE'
  ) as authenticated_cannot_create,
  not pg_catalog.has_schema_privilege(
    'anon', schema_name.oid, 'USAGE'
  ) as anon_has_no_usage,
  not pg_catalog.has_schema_privilege(
    'anon', schema_name.oid, 'CREATE'
  ) as anon_cannot_create
from pg_catalog.pg_namespace as schema_name
where schema_name.nspname = 'private';

-- Attese: una policy SELECT per authenticated, helper privato presente e
-- nessun riferimento diretto ad admin_users nell'espressione della policy.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.cmd = 'SELECT' as is_select_policy,
  policy.roles = array['authenticated']::pg_catalog.name[]
    as authenticated_only,
  policy.qual ilike '%private.is_admin()%' as uses_private_helper,
  policy.qual not ilike '%admin_users%' as no_direct_admin_users_query
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and policy.tablename = 'orders'
  and policy.policyname = 'orders_select_admin';

-- Attesa: insert, update e delete restano presenti e non usano il nuovo
-- helper; la migrazione 010 non le modifica.
select
  policy.policyname,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and policy.tablename = 'orders'
  and policy.policyname in (
    'orders_insert_admin',
    'orders_update_admin',
    'orders_delete_admin'
  )
order by policy.policyname;

-- Attese: RLS orders attiva, authenticated mantiene SELECT e anon non lo ha.
select
  protected_table.relrowsecurity as row_security_enabled,
  pg_catalog.has_table_privilege(
    'authenticated', protected_table.oid, 'SELECT'
  ) as authenticated_can_select,
  not pg_catalog.has_table_privilege(
    'anon', protected_table.oid, 'SELECT'
  ) as anon_select_revoked
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname = 'orders';
