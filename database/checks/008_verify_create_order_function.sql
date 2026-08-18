-- Coffee Break Monza
-- Controlli di sola lettura per public.create_public_order().
-- Non invoca la funzione e non modifica dati o privilegi.

-- Attesa: una riga per lo schema private; entrambi i privilegi false.
select
  schema_name.nspname as schema_name,
  pg_catalog.has_schema_privilege('anon', schema_name.oid, 'USAGE')
    as anon_has_usage,
  pg_catalog.has_schema_privilege('authenticated', schema_name.oid, 'USAGE')
    as authenticated_has_usage
from pg_catalog.pg_namespace as schema_name
where schema_name.nspname = 'private';

-- Attese: una funzione, proprietario postgres, plpgsql, SECURITY DEFINER,
-- volatile, search_path vuoto e ritorno limitato ai tre campi previsti.
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
  routine.proconfig as function_configuration,
  pg_catalog.pg_get_function_identity_arguments(routine.oid)
    as identity_arguments,
  pg_catalog.pg_get_function_arguments(routine.oid)
    as arguments_with_defaults,
  pg_catalog.pg_get_function_result(routine.oid) as result_type
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  schema_name.nspname = 'public'
  and routine.proname = 'create_public_order'
  and routine.prokind = 'f';

-- Attesa: function_count = 1.
select pg_catalog.count(*) as function_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where
  schema_name.nspname = 'public'
  and routine.proname = 'create_public_order'
  and routine.prokind = 'f';

-- Attese: PUBLIC = false, anon = true, authenticated = false.
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'create_public_order'
    and routine.prokind = 'f'
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'public'
      and privilege.routine_name = 'create_public_order'
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_execute_revoked,
  pg_catalog.has_function_privilege(
    'anon', target_function.oid, 'EXECUTE'
  ) as anon_can_execute,
  pg_catalog.has_function_privilege(
    'authenticated', target_function.oid, 'EXECUTE'
  ) as authenticated_can_execute
from target_function;

-- Attese: tutti i valori false. anon resta privo di accesso diretto.
select
  table_name,
  pg_catalog.has_table_privilege(
    'anon', pg_catalog.format('public.%I', table_name), 'SELECT'
  ) as anon_can_select,
  pg_catalog.has_table_privilege(
    'anon', pg_catalog.format('public.%I', table_name), 'INSERT'
  ) as anon_can_insert,
  pg_catalog.has_table_privilege(
    'anon', pg_catalog.format('public.%I', table_name), 'UPDATE'
  ) as anon_can_update,
  pg_catalog.has_table_privilege(
    'anon', pg_catalog.format('public.%I', table_name), 'DELETE'
  ) as anon_can_delete
from (values ('orders'), ('order_items')) as protected_table(table_name)
order by table_name;

-- Attese: RLS attiva su entrambe le tabelle.
select
  protected_table.relname as table_name,
  protected_table.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname in ('orders', 'order_items')
order by protected_table.relname;

-- Attese: tutti i valori true.
with function_definition as (
  select pg_catalog.pg_get_functiondef(routine.oid) as definition
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'create_public_order'
    and routine.prokind = 'f'
)
select
  definition not ilike '%service_role%' as no_service_role_reference,
  definition not ilike '%auth.users%' as no_auth_users_reference,
  definition !~* '\mexecute\M' as no_dynamic_execute,
  definition not ilike '%format(%' as no_format_query,
  definition not ilike '%||%' as no_query_concatenation,
  definition ilike '%set search_path to %' as search_path_is_configured,
  definition ilike '%security definer%' as security_definer_is_declared,
  definition ilike '%public.menu_items%' as menu_items_is_qualified,
  definition ilike '%public.orders%' as orders_is_qualified,
  definition ilike '%public.order_items%' as order_items_is_qualified
from function_definition;

-- Attese: tutti i conteggi pari a zero. I pattern cercano valori letterali,
-- non i nomi dei parametri o il pattern usato per convalidare gli UUID.
with function_source as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'public'
    and routine.proname = 'create_public_order'
    and routine.prokind = 'f'
)
select
  pg_catalog.count(*) filter (
    where source_code
      ~* '''[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'''
  ) as uuid_literal_count,
  pg_catalog.count(*) filter (
    where source_code ~* '''[^'']+@[^'']+\.[^'']+'''
  ) as email_literal_count,
  pg_catalog.count(*) filter (
    where source_code ~ '''[+0-9 ()-]{7,}'''
  ) as phone_literal_count,
  pg_catalog.count(*) filter (
    where source_code
      ~* '''(via|viale|piazza|corso)[[:space:]][^'']+'''
  ) as address_literal_count
from function_source;

-- Attesa: nessuna funzione esposta nello schema private.
select pg_catalog.count(*) as private_function_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'private';

-- Conteggi informativi prima dei test manuali.
select
  (select pg_catalog.count(*) from public.orders) as order_count,
  (select pg_catalog.count(*) from public.order_items) as order_item_count;
