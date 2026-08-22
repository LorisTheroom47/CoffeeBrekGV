-- Coffee Break GV
-- Controlli di sola lettura per consegna ospedaliera A/B/C.
-- Non invoca la RPC e non modifica dati, schema o privilegi.

-- Attese: delivery_point = text, nullable; vecchie colonne ancora presenti e nullable.
select
  column_definition.column_name,
  column_definition.data_type,
  column_definition.udt_schema,
  column_definition.udt_name,
  column_definition.is_nullable
from information_schema.columns as column_definition
where
  column_definition.table_schema = 'public'
  and column_definition.table_name = 'orders'
  and column_definition.column_name in (
    'delivery_point',
    'delivery_address',
    'delivery_city',
    'delivery_postal_code'
  )
order by column_definition.column_name;

-- Attese: tutti true salvo validated_for_existing_rows, mantenuto false per rollout sicuro.
with target_constraint as (
  select
    constraint_definition.conname as constraint_name,
    constraint_definition.contype as constraint_type,
    constraint_definition.convalidated as validated_for_existing_rows,
    pg_catalog.pg_get_constraintdef(constraint_definition.oid, true)
      as definition
  from pg_catalog.pg_constraint as constraint_definition
  where
    constraint_definition.conrelid = 'public.orders'::pg_catalog.regclass
    and constraint_definition.conname = 'orders_fulfillment_details_valid'
)
select
  constraint_name,
  constraint_type,
  validated_for_existing_rows,
  definition,
  definition ilike '%delivery_point = any%'
    or definition ilike '%delivery_point in (%A%, %B%, %C%)%'
    as delivery_points_are_restricted,
  definition ilike '%delivery_point is null%'
    and definition ilike '%delivery_address is not null%'
    and definition ilike '%btrim(delivery_address) <>%'
    and definition ilike '%delivery_city is not null%'
    and definition ilike '%btrim(delivery_city) <>%'
    and definition ilike '%delivery_postal_code is not null%'
    and definition ilike '%btrim(delivery_postal_code) <>%'
    as legacy_delivery_is_compatible,
  definition ilike '%fulfillment_type = ''delivery''%'
    and definition ilike '%payment_method = ''on_delivery''%'
    as delivery_payment_method_is_consistent,
  definition ilike '%fulfillment_type = ''pickup''%'
    and definition ilike '%payment_method = ''on_pickup''%'
    as pickup_payment_method_is_consistent
from target_constraint;

-- Attese: nuova firma presente, precedente assente, overload_count = 1.
select
  pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  ) is not null as new_signature_present,
  pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,text,text,time without time zone,text)'
  ) is null as previous_signature_absent,
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

-- Attese: tutti true. Verifica consegna, fee, idempotenza e assenza dei vecchi campi.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%p_delivery_point%' as delivery_point_parameter_used,
  source_code ilike '%v_delivery_point not in (%A%, %B%, %C%)%'
    as delivery_points_are_restricted,
  source_code ilike '%v_delivery_fee constant%2.50%'
    as delivery_fee_is_unchanged,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as advisory_lock_present,
  source_code ilike '%v_existing_fingerprint <> p_request_fingerprint%'
    as fingerprint_comparison_present,
  source_code ilike '%idempotency_key%'
    and source_code ilike '%request_fingerprint%'
    as idempotency_fields_present,
  source_code not ilike '%delivery_address%'
    and source_code not ilike '%delivery_city%'
    and source_code not ilike '%delivery_postal_code%'
    as legacy_delivery_fields_not_used,
  source_code !~* '\mexecute\M' as no_dynamic_execute
from function_definition;

-- Attese: RLS attiva; elenco policy invariato rispetto allo stato precedente.
select
  protected_table.relname as table_name,
  protected_table.relrowsecurity as row_security_enabled,
  protected_table.relforcerowsecurity as row_security_forced
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname in ('orders', 'order_items')
order by protected_table.relname;

select
  policy_definition.tablename,
  policy_definition.policyname,
  policy_definition.cmd,
  policy_definition.roles,
  policy_definition.qual,
  policy_definition.with_check
from pg_catalog.pg_policies as policy_definition
where
  policy_definition.schemaname = 'public'
  and policy_definition.tablename in ('orders', 'order_items')
order by policy_definition.tablename, policy_definition.policyname;

-- Attese: funzione e trigger Broadcast presenti e invariati.
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

-- Attese: tutti true. I vincoli di idempotenza restano invariati.
with order_constraints as (
  select
    constraint_definition.conname,
    constraint_definition.contype,
    pg_catalog.pg_get_constraintdef(constraint_definition.oid, true)
      as definition
  from pg_catalog.pg_constraint as constraint_definition
  where constraint_definition.conrelid = 'public.orders'::pg_catalog.regclass
)
select
  exists (
    select 1
    from order_constraints
    where conname = 'orders_idempotency_key_key' and contype = 'u'
  ) as idempotency_key_is_unique,
  exists (
    select 1
    from order_constraints
    where conname = 'orders_idempotency_fields_together' and contype = 'c'
  ) as idempotency_fields_are_paired,
  exists (
    select 1
    from order_constraints
    where conname = 'orders_request_fingerprint_valid' and contype = 'c'
  ) as fingerprint_format_is_checked;
