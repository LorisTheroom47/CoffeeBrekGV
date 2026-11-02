-- Coffee Break GV
-- Verifica read-only della migrazione 032_add_delivery_points.sql.

-- Atteso: un solo vincolo, ancora NOT VALID per il rollout compatibile.
with fulfillment_constraint as (
  select
    constraint_row.convalidated,
    pg_catalog.pg_get_constraintdef(
      constraint_row.oid,
      true
    ) as definition
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as table_row
    on table_row.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as schema_row
    on schema_row.oid = table_row.relnamespace
  where schema_row.nspname = 'public'
    and table_row.relname = 'orders'
    and constraint_row.conname = 'orders_fulfillment_details_valid'
)
select
  pg_catalog.count(*) = 1 as fulfillment_constraint_exists_once,
  pg_catalog.bool_and(not convalidated)
    as fulfillment_constraint_is_not_valid,
  pg_catalog.bool_and(
    definition ilike '%''A''%'
    and definition ilike '%''B''%'
    and definition ilike '%''C''%'
    and definition ilike '%''PRONTO_SOCCORSO''%'
    and definition ilike '%''PALAZZINA_BLU''%'
    and definition ilike '%''SALE_OPERATORIE''%'
    and definition ilike '%''BLOCCO_OPERATORIO_F''%'
  ) as all_seven_delivery_points_are_allowed,
  pg_catalog.bool_and(
    definition ilike '%delivery_point is null%'
    and definition ilike '%delivery_address is not null%'
    and definition ilike '%delivery_city is not null%'
    and definition ilike '%delivery_postal_code is not null%'
  ) as legacy_delivery_is_preserved,
  pg_catalog.bool_and(
    definition ilike '%fulfillment_type = ''pickup''%'
    and definition ilike '%payment_method = ''on_pickup''%'
  ) as pickup_is_preserved
from fulfillment_constraint;

-- Attesi: firma invariata e nessun overload aggiuntivo.
select
  pg_catalog.count(*) filter (
    where routine.oid = pg_catalog.to_regprocedure(
      'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
    )
  ) = 1 as expected_signature_exists,
  pg_catalog.count(*) = 1 as no_create_public_order_overload
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = routine.pronamespace
where schema_row.nspname = 'public'
  and routine.proname = 'create_public_order';

-- Attesi: i nuovi codici sono validati dalla RPC e le protezioni esistenti
-- per orari, consegna gratuita, idempotenza e catalogo restano presenti.
with function_definition as (
  select pg_catalog.pg_get_functiondef(routine.oid) as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%''SALE_OPERATORIE''%'
    and source_code ilike '%''BLOCCO_OPERATORIO_F''%'
    as new_delivery_points_are_validated,
  source_code ilike '%''PRONTO_SOCCORSO''%'
    and source_code ilike '%''PALAZZINA_BLU''%'
    and source_code ilike '%''A''%'
    and source_code ilike '%''B''%'
    and source_code ilike '%''C''%'
    as existing_delivery_points_are_preserved,
  source_code ilike '%time ''12:00:00''%'
    and source_code ilike '%time ''14:00:00''%'
    as delivery_time_window_is_preserved,
  source_code ilike '%v_delivery_fee constant pg_catalog.numeric(10, 2) := 0.00%'
    as free_delivery_is_preserved,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock%'
    and source_code ilike '%IDEMPOTENCY_CONFLICT%'
    as idempotency_is_preserved,
  source_code ilike '%menu_item.available = true%'
    and source_code ilike '%menu_item.orderable = true%'
    as menu_item_protections_are_preserved
from function_definition;

-- Attesi: owner postgres, SECURITY DEFINER, search_path vuoto.
select
  owner_role.rolname = 'postgres' as owner_is_postgres,
  routine.prosecdef as security_definer,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    in ('search_path=""', 'search_path=') as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_roles as owner_role
  on owner_role.oid = routine.proowner
where routine.oid = pg_catalog.to_regprocedure(
  'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
);

-- Attesi: solo service_role può eseguire la RPC pubblica ordini.
with target_function as (
  select pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  ) as oid
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where privilege.specific_schema = 'public'
      and privilege.routine_name = 'create_public_order'
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_execute_revoked,
  not pg_catalog.has_function_privilege(
    'anon', target_function.oid, 'EXECUTE'
  ) as anon_execute_revoked,
  not pg_catalog.has_function_privilege(
    'authenticated', target_function.oid, 'EXECUTE'
  ) as authenticated_execute_revoked,
  pg_catalog.has_function_privilege(
    'service_role', target_function.oid, 'EXECUTE'
  ) as service_role_can_execute
from target_function
where target_function.oid is not null;
