-- Coffee Break GV
-- Controlli di sola lettura per personalizzazioni Panini/Piadine.
-- Non invoca RPC e non modifica dati, schema, policy o privilegi.

-- Attese: due righe; customizable boolean NOT NULL default false ed
-- extras_unit_price numeric NOT NULL default 0.
select
  column_definition.table_name,
  column_definition.column_name,
  column_definition.data_type,
  column_definition.udt_schema,
  column_definition.udt_name,
  column_definition.is_nullable,
  column_definition.column_default
from information_schema.columns as column_definition
where
  column_definition.table_schema = 'public'
  and (
    (
      column_definition.table_name = 'menu_items'
      and column_definition.column_name = 'customizable'
    )
    or (
      column_definition.table_name = 'order_items'
      and column_definition.column_name = 'extras_unit_price'
    )
  )
order by column_definition.table_name, column_definition.column_name;

-- Attese: 9 colonne per menu_item_extras e 7 per order_item_extras.
select
  column_definition.table_name,
  column_definition.ordinal_position,
  column_definition.column_name,
  column_definition.data_type,
  column_definition.is_nullable,
  column_definition.column_default
from information_schema.columns as column_definition
where
  column_definition.table_schema = 'public'
  and column_definition.table_name in (
    'menu_item_extras',
    'order_item_extras'
  )
order by
  column_definition.table_name,
  column_definition.ordinal_position;

-- Attesi: vincoli enum-like, prezzi non negativi, nome non vuoto e ordine
-- non negativo sulla tabella catalogo.
select
  constraint_definition.conname as constraint_name,
  constraint_definition.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid) as definition
from pg_catalog.pg_constraint as constraint_definition
where constraint_definition.conrelid =
  'public.menu_item_extras'::pg_catalog.regclass
order by constraint_definition.conname;

-- Attesi: extras_unit_price non negativo e line_total calcolato come
-- (unit_price + extras_unit_price) * quantity.
select
  constraint_definition.conname as constraint_name,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid) as definition,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid)
    ilike '%extras_unit_price >= 0%'
    as extras_price_is_non_negative,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid)
    ilike '%line_total%'
    and pg_catalog.pg_get_constraintdef(constraint_definition.oid)
      ilike '%unit_price%'
    and pg_catalog.pg_get_constraintdef(constraint_definition.oid)
      ilike '%extras_unit_price%'
    and pg_catalog.pg_get_constraintdef(constraint_definition.oid)
      ilike '%quantity%'
    as line_total_uses_base_and_extras
from pg_catalog.pg_constraint as constraint_definition
where
  constraint_definition.conrelid = 'public.order_items'::pg_catalog.regclass
  and constraint_definition.conname in (
    'order_items_extras_unit_price_non_negative',
    'order_items_line_total_matches_quantity'
  )
order by constraint_definition.conname;

-- Attesi: UNIQUE(order_item_id, group_code), gruppi validi, prezzo non
-- negativo, FK ordine con DELETE CASCADE ed extra catalogo con DELETE SET NULL.
select
  constraint_definition.conname as constraint_name,
  constraint_definition.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_definition.oid) as definition,
  case
    when constraint_definition.conname =
      'order_item_extras_order_item_id_fkey'
      then constraint_definition.confdeltype = 'c'
    when constraint_definition.conname = 'order_item_extras_extra_id_fkey'
      then constraint_definition.confdeltype = 'n'
    else null
  end as expected_delete_action
from pg_catalog.pg_constraint as constraint_definition
where constraint_definition.conrelid =
  'public.order_item_extras'::pg_catalog.regclass
order by constraint_definition.conname;

-- Attese: RLS e FORCE RLS attive su entrambe le nuove tabelle.
select
  protected_table.relname as table_name,
  protected_table.relrowsecurity as row_security_enabled,
  protected_table.relforcerowsecurity as row_security_forced
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname in (
    'menu_item_extras',
    'order_item_extras'
  )
order by protected_table.relname;

-- Attese: lettura anon limitata ad available=true; scritture catalogo
-- esclusivamente tramite private.is_admin(); snapshot leggibili soltanto da
-- private.can_manage_orders().
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
  and policy_definition.tablename in (
    'menu_item_extras',
    'order_item_extras'
  )
order by
  policy_definition.tablename,
  policy_definition.policyname;

-- Attesi: public_or_anon_write_grant_count = 0,
-- authenticated_order_item_extra_write_grant_count = 0.
select
  pg_catalog.count(*) filter (
    where
      privilege.grantee in ('PUBLIC', 'anon')
      and privilege.privilege_type in (
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      )
  ) as public_or_anon_write_grant_count,
  pg_catalog.count(*) filter (
    where
      privilege.table_name = 'order_item_extras'
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type in (
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER'
      )
  ) as authenticated_order_item_extra_write_grant_count
from information_schema.table_privileges as privilege
where
  privilege.table_schema = 'public'
  and privilege.table_name in (
    'menu_item_extras',
    'order_item_extras'
  );

-- Attesi: tutti zero. L'operatore non riceve policy di scrittura e gli
-- snapshot non hanno alcuna policy INSERT/UPDATE/DELETE.
select
  pg_catalog.count(*) filter (
    where concat_ws(
      ' ',
      policy_definition.qual,
      policy_definition.with_check
    ) ~* '(order_operators|can_manage_orders)'
  ) as operator_write_policy_count,
  pg_catalog.count(*) filter (
    where concat_ws(
      ' ',
      policy_definition.qual,
      policy_definition.with_check
    ) not ilike '%private.is_admin()%'
  ) as non_admin_menu_extra_write_policy_count,
  pg_catalog.count(*) filter (
    where policy_definition.tablename = 'order_item_extras'
  ) as order_item_extra_write_policy_count
from pg_catalog.pg_policies as policy_definition
where
  policy_definition.schemaname = 'public'
  and policy_definition.tablename in (
    'menu_item_extras',
    'order_item_extras'
  )
  and policy_definition.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');

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

-- Attesi: postgres, PL/pgSQL, VOLATILE, SECURITY DEFINER e search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.provolatile = 'v' as is_volatile,
  coalesce(pg_catalog.array_to_string(routine.proconfig, ','), '')
    = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where routine.oid = pg_catalog.to_regprocedure(
  'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
);

-- Attesi: tutti true. Controlli statici sulla validazione delle
-- personalizzazioni e sul calcolo esclusivamente server-side.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%''cheese_extra_id''%'
    and source_code ilike '%''vegetable_extra_id''%'
    and source_code ilike '%''sauce_extra_id''%'
    as optional_extra_fields_present,
  source_code ilike '%customizable = true%'
    as customizable_is_required,
  source_code ilike '%category.slug%''panini''%'
    and source_code ilike '%category.slug%''piadine''%'
    as panini_and_piadine_are_required,
  source_code ilike '%''FORMAGGIO''%'
    and source_code ilike '%''VERDURA''%'
    and source_code ilike '%''SALSA''%'
    as groups_are_validated,
  source_code ilike '%menu_item_extra.available = true%'
    and source_code ilike '%menu_item_extra.group_code = requested_extra.group_code%'
    and source_code ilike '%menu_item_extra.applies_to%'
    as extra_availability_group_and_scope_are_validated,
  source_code ilike '%for share of menu_item%'
    and source_code ilike '%for share of menu_item_extra%'
    as menu_items_and_extras_are_locked,
  source_code ilike '%locked_item.price + extra_total.extras_unit_price%'
    and source_code ilike '%public.order_item_extras%'
    as prices_and_snapshots_are_server_side,
  source_code ilike '%v_inserted_extra_count <> v_requested_extra_count%'
    as snapshot_insert_count_is_checked,
  source_code !~* '\mexecute\M' as no_dynamic_execute
from function_definition;

-- Attesi: tutti true. La normalizzazione degli UUID degli extra partecipa al
-- fingerprint effettivo, mentre gli ordini senza extra conservano il vecchio
-- fingerprint per permettere retry storici.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%v_normalized_extra_payload%'
    and source_code ilike '%pg_catalog.lower(input_item.value ->> ''cheese_extra_id'')%'
    and source_code ilike '%pg_catalog.lower(input_item.value ->> ''vegetable_extra_id'')%'
    and source_code ilike '%pg_catalog.lower(input_item.value ->> ''sauce_extra_id'')%'
    as extra_ids_are_normalized,
  source_code ilike '%coffee-break-extras-v1%'
    and source_code ilike '%pg_catalog.sha256(%'
    and source_code ilike '%pg_catalog.encode(%'
    as extra_fingerprint_is_derived,
  source_code ilike '%v_existing_fingerprint <> v_effective_request_fingerprint%'
    as effective_fingerprint_is_compared,
  source_code ilike '%v_effective_request_fingerprint := p_request_fingerprint%'
    as historical_retry_compatibility_is_preserved,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as advisory_lock_is_preserved,
  source_code ilike '%IDEMPOTENCY_CONFLICT%'
    as idempotency_conflict_is_preserved
from function_definition;

-- Attesi: tutti true. Protezioni preesistenti preservate.
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
    as delivery_points_are_preserved
from function_definition;

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
    where
      privilege.specific_schema = 'public'
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

-- Attesi: zero righe non conformi. Valido anche dopo l'uso reale della
-- funzionalità e conferma la compatibilità degli ordini storici.
select
  pg_catalog.count(*) filter (
    where extras_unit_price < 0
  ) as negative_extras_price_count,
  pg_catalog.count(*) filter (
    where line_total <> (unit_price + extras_unit_price) * quantity
  ) as invalid_line_total_count
from public.order_items;

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
