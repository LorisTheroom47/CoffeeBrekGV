-- Coffee Break GV
-- Controlli di sola lettura per l'accesso ristoratore limitato agli ordini.
-- Non invoca RPC e non modifica dati, policy o privilegi.

-- Attese: due colonne, user_id non nullo/PK e created_at non nullo.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'order_operators'
order by ordinal_position;

-- Attese: RLS e FORCE RLS attive.
select
  protected_table.relrowsecurity as row_security_enabled,
  protected_table.relforcerowsecurity as row_security_forced
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname = 'order_operators';

-- Attese: FK user_id -> auth.users(id), UPDATE e DELETE CASCADE.
select
  constraint_name.conname as constraint_name,
  pg_catalog.pg_get_constraintdef(constraint_name.oid) as definition,
  constraint_name.confupdtype = 'c' as update_cascades,
  constraint_name.confdeltype = 'c' as delete_cascades
from pg_catalog.pg_constraint as constraint_name
join pg_catalog.pg_class as source_table
  on source_table.oid = constraint_name.conrelid
join pg_catalog.pg_namespace as source_schema
  on source_schema.oid = source_table.relnamespace
where
  source_schema.nspname = 'public'
  and source_table.relname = 'order_operators'
  and constraint_name.contype = 'f';

-- Attese: policy SELECT propria per authenticated e nessuna policy di scrittura.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.cmd = 'SELECT' as is_select_policy,
  policy.roles = array['authenticated']::pg_catalog.name[]
    as authenticated_only,
  policy.qual ilike '%auth.uid()%' as checks_own_user
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and policy.tablename = 'order_operators';

-- Attese: PUBLIC/anon nessun privilegio e authenticated soltanto SELECT.
select
  privilege.grantee,
  privilege.privilege_type
from information_schema.role_table_grants as privilege
where
  privilege.table_schema = 'public'
  and privilege.table_name = 'order_operators'
order by privilege.grantee, privilege.privilege_type;

-- Attese: due helper, owner postgres, SQL, STABLE, SECURITY DEFINER,
-- nessun parametro, boolean e search_path vuoto.
select
  routine.proname as function_name,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.provolatile = 's' as is_stable,
  routine.pronargs as argument_count,
  pg_catalog.pg_get_function_result(routine.oid) as result_type,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  schema_name.nspname = 'private'
  and routine.proname in ('is_order_operator', 'can_manage_orders')
  and routine.prokind = 'f'
order by routine.proname;

-- Attese: helper corretti, nessun SQL dinamico o service_role.
select
  routine.proname as function_name,
  routine.prosrc ilike '%auth.uid()%' as uses_auth_uid,
  routine.prosrc ilike '%public.order_operators%'
    as uses_order_operators,
  routine.prosrc ilike '%private.is_admin()%'
    as uses_admin_helper,
  routine.prosrc ilike '%private.is_order_operator()%'
    as uses_operator_helper,
  routine.prosrc !~* '\mexecute\M' as no_dynamic_execute,
  routine.prosrc not ilike '%format(%' as no_dynamic_format,
  pg_catalog.pg_get_functiondef(routine.oid) not ilike '%service_role%'
    as no_service_role
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where
  schema_name.nspname = 'private'
  and routine.proname in ('is_order_operator', 'can_manage_orders')
order by routine.proname;

-- Attese: PUBLIC false, anon false, authenticated true per entrambi gli helper.
select
  routine.proname as function_name,
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'private'
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
where
  schema_name.nspname = 'private'
  and routine.proname in ('is_order_operator', 'can_manage_orders')
order by routine.proname;

-- Attese: SELECT ordini e righe ordine usa can_manage_orders per authenticated.
select
  policy.tablename,
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.cmd = 'SELECT' as is_select_policy,
  policy.roles = array['authenticated']::pg_catalog.name[]
    as authenticated_only,
  policy.qual ilike '%private.can_manage_orders()%'
    as uses_order_access_helper
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and (
    (policy.tablename = 'orders' and policy.policyname = 'orders_select_admin')
    or (
      policy.tablename = 'order_items'
      and policy.policyname = 'order_items_select_admin'
    )
  )
order by policy.tablename;

-- Attesa: operator_update_policy_count = 0. Le policy UPDATE generali
-- continuano a richiedere esclusivamente admin_users.
select pg_catalog.count(*) as operator_update_policy_count
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'public'
  and policy.tablename = 'orders'
  and policy.cmd in ('UPDATE', 'ALL')
  and concat_ws(' ', policy.qual, policy.with_check)
    ~* '(order_operators|can_manage_orders)';

-- Attese: INSERT/UPDATE/DELETE ordini restano limitate ad admin_users e non
-- includono helper o tabella degli operatori.
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
  and policy.policyname in (
    'orders_insert_admin',
    'orders_update_admin',
    'orders_delete_admin'
  )
order by policy.policyname;

-- Attese: authenticated può leggere entrambe le tabelle; anon non può.
select
  protected_table.relname as table_name,
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
  and protected_table.relname in ('orders', 'order_items')
order by protected_table.relname;

-- Attese: RPC unica, owner postgres, PL/pgSQL, VOLATILE, SECURITY DEFINER,
-- tre parametri, ritorno text e search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.provolatile = 'v' as is_volatile,
  routine.pronargs as argument_count,
  pg_catalog.pg_get_function_result(routine.oid) as result_type,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  schema_name.nspname = 'public'
  and routine.proname = 'update_order_status'
  and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid, text, text';

-- Attese: controllo ruolo e transizioni, lock, UPDATE del solo status,
-- nessun SQL dinamico e nessuna service_role.
with rpc_definition as (
  select
    routine.prosrc as source_code,
    pg_catalog.pg_get_functiondef(routine.oid) as definition
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'update_order_status'
    and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid, text, text'
)
select
  source_code ilike '%private.can_manage_orders()%'
    as checks_order_access,
  source_code ilike '%for update%' as locks_order,
  source_code ilike '%set status = p_target_status%'
    as updates_only_status,
  source_code ilike '%invalid_transition%' as validates_transitions,
  source_code ilike '%conflict%' as detects_concurrent_change,
  source_code !~* '\mexecute\M' as no_dynamic_execute,
  source_code not ilike '%format(%' as no_dynamic_format,
  definition not ilike '%service_role%' as no_service_role
from rpc_definition;

-- Attese: PUBLIC false, anon false, authenticated true per la RPC.
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'update_order_status'
    and pg_catalog.oidvectortypes(routine.proargtypes) = 'uuid, text, text'
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'public'
      and privilege.routine_name = 'update_order_status'
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

-- Attese: Broadcast privato, topic esatto e accesso tramite can_manage_orders.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.qual ilike '%extension%broadcast%' as broadcast_only,
  policy.qual ilike '%admin:orders%' as expected_topic_only,
  policy.qual ilike '%private.can_manage_orders()%'
    as uses_order_access_helper
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'realtime'
  and policy.tablename = 'messages'
  and policy.policyname = 'orders_broadcast_receive_admin';

-- Attese: admin_users resta composta soltanto da user_id e created_at.
select
  pg_catalog.count(*) as admin_users_column_count,
  pg_catalog.count(*) filter (
    where column_name in ('user_id', 'created_at')
  ) = 2 as expected_columns_only
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'admin_users';

-- Attese: RLS/FORCE RLS e policy personale di admin_users restano invariate.
select
  protected_table.relrowsecurity as row_security_enabled,
  protected_table.relforcerowsecurity as row_security_forced,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies as policy
    where
      policy.schemaname = 'public'
      and policy.tablename = 'admin_users'
      and policy.policyname = 'admin_users_select_own'
      and policy.cmd = 'SELECT'
      and policy.roles = array['authenticated']::pg_catalog.name[]
      and policy.qual ilike '%auth.uid()%'
  ) = 1 as own_select_policy_unchanged
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname = 'admin_users';
