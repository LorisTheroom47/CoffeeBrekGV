-- CB-010B.2B - Controlli di sola lettura per il confine fidato ordini.
-- Risultati attesi:
--   exact_function_count = 1
--   public_execute_count = 0
--   anon_execute = false
--   authenticated_execute = false
--   service_role_execute = true
--   unexpected_explicit_execute_count = 0

with target_function as (
  select pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,text,text,text,text,time without time zone,text)'
  ) as function_oid
)
select pg_catalog.count(*) as exact_function_count
from pg_catalog.pg_proc as procedure
cross join target_function
where procedure.oid = target_function.function_oid;

select pg_catalog.count(*) as create_public_order_overload_count
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace
  on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname = 'create_public_order';

with target_function as (
  select pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,text,text,text,text,time without time zone,text)'
  ) as function_oid
)
select
  owner_role.rolname as owner,
  procedure.prosecdef as security_definer,
  procedure.provolatile as volatility,
  procedure.proconfig as function_settings
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_roles as owner_role
  on owner_role.oid = procedure.proowner
cross join target_function
where procedure.oid = target_function.function_oid;

select pg_catalog.count(*) as public_execute_count
from information_schema.routine_privileges as privilege
where privilege.routine_schema = 'public'
  and privilege.routine_name = 'create_public_order'
  and privilege.privilege_type = 'EXECUTE'
  and privilege.grantee = 'PUBLIC';

with target_function as (
  select pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,text,text,text,text,time without time zone,text)'
  ) as function_oid
)
select
  pg_catalog.has_function_privilege(
    'anon',
    target_function.function_oid,
    'EXECUTE'
  ) as anon_execute,
  pg_catalog.has_function_privilege(
    'authenticated',
    target_function.function_oid,
    'EXECUTE'
  ) as authenticated_execute,
  pg_catalog.has_function_privilege(
    'service_role',
    target_function.function_oid,
    'EXECUTE'
  ) as service_role_execute
from target_function;

select pg_catalog.count(*) as unexpected_explicit_execute_count
from information_schema.routine_privileges as privilege
where privilege.routine_schema = 'public'
  and privilege.routine_name = 'create_public_order'
  and privilege.privilege_type = 'EXECUTE'
  and privilege.grantee not in ('postgres', 'service_role');

select
  table_info.relrowsecurity as orders_rls_enabled,
  table_info.relforcerowsecurity as orders_rls_forced
from pg_catalog.pg_class as table_info
join pg_catalog.pg_namespace as namespace
  on namespace.oid = table_info.relnamespace
where namespace.nspname = 'public'
  and table_info.relname = 'orders';

select pg_catalog.count(*) as anon_order_table_privilege_count
from information_schema.role_table_grants as privilege
where privilege.table_schema = 'public'
  and privilege.table_name in ('orders', 'order_items')
  and privilege.grantee = 'anon';
