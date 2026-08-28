-- Coffee Break GV
-- Controlli read-only per la migrazione 026.
-- Non modifica schema, dati, policy o privilegi.

-- Attesi: firma presente e un solo overload.
select
  pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  ) is not null as expected_signature_present,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as schema_name
      on schema_name.oid = routine.pronamespace
    where schema_name.nspname = 'public'
      and routine.proname = 'create_public_order'
      and routine.prokind = 'f'
  ) = 1 as one_overload_only;

-- Attesi: tutti true. Le righe hanno identità propria e il vecchio divieto
-- generale sui menu_item_id duplicati non è più presente.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code not ilike
    '%group by%(input_item.value ->> ''menu_item_id'')::pg_catalog.uuid%having pg_catalog.count(*) > 1%'
    as duplicate_menu_item_id_guard_removed,
  source_code ilike
    '%with ordinality as input_item(value, ordinality)%'
    as request_line_ordinality_present,
  source_code ilike
    '%input_item.ordinality::pg_catalog.int4 as line_index%'
    as stable_line_index_present,
  source_code ilike
    '%''order_item_id'', pg_catalog.gen_random_uuid()%'
    as server_generated_order_item_id_present
from function_definition;

-- Attesi: tutti true. Extra, totali e validazione sono separati per riga.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike
    '%requested_extra.line_index%'
    and source_code ilike
      '%locked_menu_item.line_index = requested_extra.line_index%'
    as requested_extras_are_line_scoped,
  source_code ilike
    '%locked_extra.line_index = parsed_item.line_index%'
    and source_code ilike
      '%group by parsed_item.line_index, parsed_item.menu_item_id%'
    as extra_totals_are_line_scoped,
  source_code ilike
    '%locked_item.line_index = parsed_item.line_index%'
    and source_code ilike
      '%extra_total.line_index = parsed_item.line_index%'
    as validated_items_are_line_scoped,
  source_code ilike '%for share of menu_item%'
    and source_code ilike '%for share of menu_item_extra%'
    as server_rows_remain_locked
from function_definition;

-- Attesi: tutti true. Gli snapshot dipendono dalla specifica riga inserita
-- tramite il suo UUID, mai da un'associazione basata soltanto sul menu_item_id.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike
    '%insert into public.order_items (%id,%order_id,%menu_item_id%'
    and source_code ilike
      '%validated_item.order_item_id,%v_order_id,%validated_item.menu_item_id%'
    as order_items_use_preallocated_ids,
  source_code ilike
    '%insert into public.order_item_extras (%order_item_id,%extra_id%'
    and source_code ilike
      '%validated_item.order_item_id,%selected_extra.extra_id%'
    as snapshots_use_specific_order_item_id,
  source_code ilike
    '%inserted_item.id = validated_item.order_item_id%'
    as snapshot_insert_depends_on_specific_order_item,
  source_code not ilike
    '%inserted_item.menu_item_id = validated_item.menu_item_id%'
    as no_menu_item_only_snapshot_join
from function_definition;

-- Attesi: tutti true. La normalizzazione è indipendente dall'ordine delle
-- configurazioni duplicate e conserva i retry storici senza extra.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike
    '%order by%pg_catalog.lower(input_item.value ->> ''menu_item_id'')%'
    and source_code ilike
      '%pg_catalog.lower(input_item.value ->> ''cheese_extra_id'')%'
    and source_code ilike
      '%pg_catalog.lower(input_item.value ->> ''vegetable_extra_id'')%'
    and source_code ilike
      '%pg_catalog.lower(input_item.value ->> ''sauce_extra_id'')%'
    as duplicate_configuration_fingerprint_is_deterministic,
  source_code ilike '%coffee-break-extras-v1%'
    and source_code ilike '%pg_catalog.sha256(%'
    as extra_fingerprint_is_preserved,
  source_code ilike
    '%v_effective_request_fingerprint := p_request_fingerprint%'
    as historical_retry_compatibility_is_preserved,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as advisory_lock_is_preserved
from function_definition;

-- Attesi: tutti true. Prezzi, disponibilità, orderable, personalizzazione e
-- regole delivery rimangono autorevoli lato server.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%menu_item.available = true%'
    and source_code ilike '%menu_item.orderable = true%'
    as item_availability_and_orderable_preserved,
  source_code ilike '%locked_menu_item.customizable = true%'
    and source_code ilike '%menu_item_extra.available = true%'
    and source_code ilike '%menu_item_extra.price%'
    as customization_and_server_prices_preserved,
  source_code ilike
    '%locked_item.price + extra_total.extras_unit_price%'
    as authoritative_line_total_preserved,
  source_code ilike
    '%v_delivery_fee constant pg_catalog.numeric(10, 2) := 0.00%'
    and source_code ilike '%PRONTO_SOCCORSO%'
    and source_code ilike '%PALAZZINA_BLU%'
    and source_code ilike '%time ''12:00:00''%'
    and source_code ilike '%time ''14:00:00''%'
    as delivery_rules_preserved
from function_definition;

-- Attesi: postgres, PL/pgSQL, VOLATILE, SECURITY DEFINER e search_path vuoto.
select
  owner_role.rolname = 'postgres' as owner_is_postgres,
  language.lanname = 'plpgsql' as language_is_plpgsql,
  routine.provolatile = 'v' as function_is_volatile,
  routine.prosecdef as security_definer,
  coalesce(
    pg_catalog.array_to_string(routine.proconfig, ','),
    ''
  ) ilike '%search_path=""%' as empty_search_path
from pg_catalog.pg_proc as routine
join pg_catalog.pg_roles as owner_role
  on owner_role.oid = routine.proowner
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

-- Attesi: RLS e FORCE RLS ancora attivi sulle tabelle della 025.
select
  table_class.relname as table_name,
  table_class.relrowsecurity as rls_enabled,
  table_class.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as table_class
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_class.relnamespace
where schema_name.nspname = 'public'
  and table_class.relname in ('menu_item_extras', 'order_item_extras')
order by table_class.relname;
