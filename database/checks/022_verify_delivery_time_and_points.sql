-- Coffee Break GV
-- Controlli di sola lettura per punti e orari della consegna ospedaliera.
-- Non invoca la RPC e non modifica dati, schema o privilegi.

-- Attese: i due vincoli esistono, sono CHECK e restano NOT VALID per il
-- rollout compatibile con gli ordini storici.
select
  constraint_definition.conname as constraint_name,
  constraint_definition.contype as constraint_type,
  constraint_definition.convalidated as validated_for_existing_rows,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid, true)
    as definition
from pg_catalog.pg_constraint as constraint_definition
where
  constraint_definition.conrelid = 'public.orders'::pg_catalog.regclass
  and constraint_definition.conname in (
    'orders_fulfillment_details_valid',
    'orders_delivery_time_valid'
  )
order by constraint_definition.conname;

-- Attese: tutti true salvo validated_for_existing_rows, atteso false.
with fulfillment_constraint as (
  select
    constraint_definition.convalidated as validated_for_existing_rows,
    pg_catalog.pg_get_constraintdef(constraint_definition.oid, true)
      as definition
  from pg_catalog.pg_constraint as constraint_definition
  where
    constraint_definition.conrelid = 'public.orders'::pg_catalog.regclass
    and constraint_definition.conname = 'orders_fulfillment_details_valid'
)
select
  not validated_for_existing_rows as rollout_is_not_valid,
  definition ilike '%''A''%'
    and definition ilike '%''B''%'
    and definition ilike '%''C''%'
    and definition ilike '%''PRONTO_SOCCORSO''%'
    and definition ilike '%''PALAZZINA_BLU''%'
    as all_delivery_points_are_allowed,
  definition ilike '%delivery_point is null%'
    and definition ilike '%delivery_address is not null%'
    and definition ilike '%delivery_city is not null%'
    and definition ilike '%delivery_postal_code is not null%'
    as legacy_delivery_is_compatible,
  definition ilike '%fulfillment_type = ''delivery''%'
    and definition ilike '%payment_method = ''on_delivery''%'
    as delivery_payment_method_is_consistent,
  definition ilike '%fulfillment_type = ''pickup''%'
    and definition ilike '%payment_method = ''on_pickup''%'
    as pickup_payment_method_is_consistent
from fulfillment_constraint;

-- Attese: tutti true salvo validated_for_existing_rows, atteso false.
with time_constraint as (
  select
    constraint_definition.convalidated as validated_for_existing_rows,
    pg_catalog.pg_get_constraintdef(constraint_definition.oid, true)
      as definition
  from pg_catalog.pg_constraint as constraint_definition
  where
    constraint_definition.conrelid = 'public.orders'::pg_catalog.regclass
    and constraint_definition.conname = 'orders_delivery_time_valid'
)
select
  not validated_for_existing_rows as rollout_is_not_valid,
  definition ilike '%fulfillment_type <> ''delivery''%'
    as pickup_is_preserved,
  definition ilike '%requested_time is not null%'
    as delivery_time_is_required,
  definition ilike '%12:00:00%'
    and definition ilike '%12:15:00%'
    and definition ilike '%12:30:00%'
    and definition ilike '%12:45:00%'
    and definition ilike '%13:00:00%'
    and definition ilike '%13:15:00%'
    and definition ilike '%13:30:00%'
    and definition ilike '%13:45:00%'
    and definition ilike '%14:00:00%'
    as exact_delivery_slots_are_checked
from time_constraint;

-- Attese: una sola funzione con la firma invariata.
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

-- Attese: tutti true. Verifica punti, slot, consegna gratuita, idempotenza
-- e assenza di SQL dinamico nella RPC.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%''A''%'
    and source_code ilike '%''B''%'
    and source_code ilike '%''C''%'
    and source_code ilike '%''PRONTO_SOCCORSO''%'
    and source_code ilike '%''PALAZZINA_BLU''%'
    as all_delivery_points_are_validated,
  source_code ilike '%INVALID_REQUEST_TIME%'
    and source_code ilike '%12:00:00%'
    and source_code ilike '%12:15:00%'
    and source_code ilike '%12:30:00%'
    and source_code ilike '%12:45:00%'
    and source_code ilike '%13:00:00%'
    and source_code ilike '%13:15:00%'
    and source_code ilike '%13:30:00%'
    and source_code ilike '%13:45:00%'
    and source_code ilike '%14:00:00%'
    as exact_delivery_slots_are_validated,
  source_code ilike '%v_delivery_fee constant%0.00%'
    as delivery_remains_free,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as advisory_lock_present,
  source_code ilike '%v_existing_fingerprint <> p_request_fingerprint%'
    as fingerprint_comparison_present,
  source_code ilike '%idempotency_key%'
    and source_code ilike '%request_fingerprint%'
    as idempotency_fields_present,
  source_code !~* '\mexecute\M' as no_dynamic_execute
from function_definition;

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

-- Attese: tutti true. I vincoli di idempotenza restano invariati.
with order_constraints as (
  select
    constraint_definition.conname,
    constraint_definition.contype
  from pg_catalog.pg_constraint as constraint_definition
  where constraint_definition.conrelid = 'public.orders'::pg_catalog.regclass
)
select
  exists (
    select 1 from order_constraints
    where conname = 'orders_idempotency_key_key' and contype = 'u'
  ) as idempotency_key_is_unique,
  exists (
    select 1 from order_constraints
    where conname = 'orders_idempotency_fields_together' and contype = 'c'
  ) as idempotency_fields_are_paired,
  exists (
    select 1 from order_constraints
    where conname = 'orders_request_fingerprint_valid' and contype = 'c'
  ) as fingerprint_format_is_checked;
