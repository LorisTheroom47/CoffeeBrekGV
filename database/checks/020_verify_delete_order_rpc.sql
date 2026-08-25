-- Coffee Break GV
-- Controlli di sola lettura per la cancellazione controllata degli ordini.
-- Non invoca la RPC e non modifica dati, policy o privilegi.

-- Attese: una sola funzione con firma uuid, owner postgres, PL/pgSQL,
-- VOLATILE, SECURITY DEFINER, ritorno text e search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.provolatile = 'v' as is_volatile,
  routine.pronargs = 1 as has_one_argument,
  pg_catalog.pg_get_function_result(routine.oid) = 'text' as returns_text,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  schema_name.nspname = 'public'
  and routine.proname = 'delete_order'
  and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid';

-- Attesa: delete_order_function_count = 1.
select pg_catalog.count(*) as delete_order_function_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where
  schema_name.nspname = 'public'
  and routine.proname = 'delete_order';

-- Attese: controllo accesso interno, DELETE filtrato per ID, risultati
-- controllati, nessun SQL dinamico e nessuna service_role.
with rpc_definition as (
  select
    routine.prosrc as source_code,
    pg_catalog.pg_get_functiondef(routine.oid) as definition
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'delete_order'
    and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid'
)
select
  source_code ilike '%private.can_manage_orders()%'
    as checks_order_access,
  source_code ilike '%delete from public.orders%'
    as deletes_orders_only,
  source_code ilike '%target_order.id = p_order_id%'
    as filters_exact_order_id,
  source_code ilike '%access_denied%' as returns_access_denied,
  source_code ilike '%not_found%' as returns_not_found,
  source_code ilike '%deleted%' as returns_deleted,
  source_code !~* '\mexecute\M' as no_dynamic_execute,
  source_code not ilike '%format(%' as no_dynamic_format,
  definition not ilike '%service_role%' as no_service_role
from rpc_definition;

-- Attese: PUBLIC false, anon false, authenticated true.
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'delete_order'
    and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid'
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'public'
      and privilege.routine_name = 'delete_order'
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

-- Attesa: nessuna policy DELETE/ALL concede cancellazione generale agli
-- operatori. La cancellazione operatore passa soltanto dalla RPC controllata.
select pg_catalog.count(*) as operator_general_delete_policy_count
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and policy.tablename = 'orders'
  and policy.cmd in ('DELETE', 'ALL')
  and concat_ws(' ', policy.qual, policy.with_check)
    ~* '(order_operators|can_manage_orders)';

-- Attese: la policy DELETE diretta resta admin-only.
select
  policy.policyname,
  policy.cmd,
  concat_ws(' ', policy.qual, policy.with_check) ilike '%admin_users%'
    as still_requires_admin_users,
  concat_ws(' ', policy.qual, policy.with_check)
    !~* '(order_operators|can_manage_orders)'
    as excludes_order_operators
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and policy.tablename = 'orders'
  and policy.policyname = 'orders_delete_admin';

-- Attesa: order_items.order_id continua a usare ON DELETE CASCADE.
select
  constraint_name.conname as constraint_name,
  constraint_name.confdeltype = 'c' as delete_cascades
from pg_catalog.pg_constraint as constraint_name
join pg_catalog.pg_class as source_table
  on source_table.oid = constraint_name.conrelid
join pg_catalog.pg_namespace as source_schema
  on source_schema.oid = source_table.relnamespace
join pg_catalog.pg_class as target_table
  on target_table.oid = constraint_name.confrelid
join pg_catalog.pg_namespace as target_schema
  on target_schema.oid = target_table.relnamespace
where
  constraint_name.contype = 'f'
  and source_schema.nspname = 'public'
  and source_table.relname = 'order_items'
  and target_schema.nspname = 'public'
  and target_table.relname = 'orders'
  and pg_catalog.pg_get_constraintdef(constraint_name.oid)
    ilike '%foreign key (order_id)%';
