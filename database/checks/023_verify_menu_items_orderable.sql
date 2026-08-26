-- Coffee Break GV
-- Controlli di sola lettura per la separazione tra visibilità e ordinabilità.
-- Non invoca la RPC e non modifica dati, schema o privilegi.

-- Attese: una riga, boolean, NOT NULL, default true.
select
  column_definition.column_name,
  column_definition.data_type,
  column_definition.udt_schema,
  column_definition.udt_name,
  column_definition.is_nullable,
  column_definition.column_default
from information_schema.columns as column_definition
where
  column_definition.table_schema = 'public'
  and column_definition.table_name = 'menu_items'
  and column_definition.column_name = 'orderable';

-- Attese: caffetteria_not_orderable = caffetteria_items.
select
  pg_catalog.count(*) as caffetteria_items,
  pg_catalog.count(*) filter (
    where menu_item.orderable = false
  ) as caffetteria_not_orderable,
  pg_catalog.count(*) filter (
    where menu_item.orderable = true
  ) as caffetteria_orderable
from public.menu_items as menu_item
join public.categories as category
  on category.id = menu_item.category_id
where pg_catalog.lower(pg_catalog.btrim(category.name)) = 'caffetteria';

-- Attese: firma presente e overload_count = 1.
select
  pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  ) is not null as expected_signature_present,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as schema_name
      on schema_name.oid = routine.pronamespace
    where
      schema_name.nspname = 'public'
      and routine.proname = 'create_public_order'
      and routine.prokind = 'f'
  ) as create_public_order_overload_count;

-- Attese: postgres, plpgsql, SECURITY DEFINER, volatile, search_path vuoto.
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
  routine.proconfig as function_configuration
from pg_catalog.pg_proc as routine
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where routine.oid = pg_catalog.to_regprocedure(
  'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
);

-- Attese: PUBLIC/anon/authenticated false; service_role true.
with target_function as (
  select pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  ) as oid
)
select
  exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'public'
      and privilege.routine_name = 'create_public_order'
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_can_execute,
  pg_catalog.has_function_privilege(
    'anon', target_function.oid, 'EXECUTE'
  ) as anon_can_execute,
  pg_catalog.has_function_privilege(
    'authenticated', target_function.oid, 'EXECUTE'
  ) as authenticated_can_execute,
  pg_catalog.has_function_privilege(
    'service_role', target_function.oid, 'EXECUTE'
  ) as service_role_can_execute
from target_function
where target_function.oid is not null;

-- Attese: tutti true. La RPC applica entrambi i flag senza alterare le
-- protezioni e le regole già attive.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%menu_item.available = true%'
    as available_is_required,
  source_code ilike '%menu_item.orderable = true%'
    as orderable_is_required,
  source_code ilike '%v_delivery_fee constant%0.00%'
    as delivery_remains_free,
  source_code ilike '%INVALID_REQUEST_TIME%'
    and source_code ilike '%12:00:00%'
    and source_code ilike '%14:00:00%'
    as delivery_times_are_preserved,
  source_code ilike '%''PRONTO_SOCCORSO''%'
    and source_code ilike '%''PALAZZINA_BLU''%'
    as delivery_points_are_preserved,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as advisory_lock_present,
  source_code ilike '%v_existing_fingerprint <> p_request_fingerprint%'
    as fingerprint_comparison_present,
  source_code ilike '%idempotency_key%'
    and source_code ilike '%request_fingerprint%'
    as idempotency_fields_present,
  source_code !~* '\mexecute\M' as no_dynamic_execute
from function_definition;

-- Attese: RLS e policy delle tabelle menu restano attive e invariate.
select
  protected_table.relname as table_name,
  protected_table.relrowsecurity as row_security_enabled,
  protected_table.relforcerowsecurity as row_security_forced
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname = 'menu_items';

select
  policy_definition.policyname,
  policy_definition.cmd,
  policy_definition.roles,
  policy_definition.qual,
  policy_definition.with_check
from pg_catalog.pg_policies as policy_definition
where
  policy_definition.schemaname = 'public'
  and policy_definition.tablename = 'menu_items'
order by policy_definition.policyname;

-- Attese: funzione, trigger e policy Broadcast ancora presenti.
select
  pg_catalog.to_regprocedure('private.broadcast_new_order()') is not null
    as broadcast_function_present,
  exists (
    select 1
    from pg_catalog.pg_trigger as trigger_definition
    where
      trigger_definition.tgrelid = 'public.orders'::pg_catalog.regclass
      and trigger_definition.tgname = 'orders_broadcast_new_order'
      and not trigger_definition.tgisinternal
  ) as broadcast_trigger_present,
  exists (
    select 1
    from pg_catalog.pg_policies as policy_definition
    where
      policy_definition.schemaname = 'realtime'
      and policy_definition.tablename = 'messages'
      and policy_definition.policyname = 'orders_broadcast_receive_admin'
  ) as broadcast_policy_present;
