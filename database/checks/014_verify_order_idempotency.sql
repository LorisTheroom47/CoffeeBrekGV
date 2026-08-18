-- Coffee Break Monza
-- Controlli di sola lettura per l'idempotenza degli ordini.
-- Non invoca la RPC e non modifica dati, schema o privilegi.

-- Attese: due righe; uuid/text; entrambe nullable per gli ordini storici.
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
    'idempotency_key',
    'request_fingerprint'
  )
order by column_definition.column_name;

-- Attese: tutti i valori true.
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
    where
      conname = 'orders_idempotency_key_key'
      and contype = 'u'
      and definition ilike '%unique (idempotency_key)%'
  ) as idempotency_key_is_unique,
  exists (
    select 1
    from order_constraints
    where
      conname = 'orders_idempotency_fields_together'
      and contype = 'c'
      and definition ilike '%idempotency_key is null%'
      and definition ilike '%request_fingerprint is null%'
      and definition ilike '%idempotency_key is not null%'
      and definition ilike '%request_fingerprint is not null%'
  ) as idempotency_fields_are_paired,
  exists (
    select 1
    from order_constraints
    where
      conname = 'orders_request_fingerprint_valid'
      and contype = 'c'
      and definition like '%[0-9a-f]{64}%'
  ) as fingerprint_format_is_checked;

-- Attese: nuova firma presente, vecchia firma assente, un solo overload.
select
  pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,text,text,time without time zone,text)'
  ) is not null as new_signature_present,
  pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,text,text,text,text,time without time zone,text)'
  ) is null as old_signature_absent,
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
  routine.proconfig as function_configuration,
  pg_catalog.pg_get_function_identity_arguments(routine.oid)
    as identity_arguments,
  pg_catalog.pg_get_function_result(routine.oid) as result_type
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,text,text,time without time zone,text)'
  );

-- Attese: PUBLIC/anon/authenticated false; service_role true.
with target_function as (
  select pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,text,text,time without time zone,text)'
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

-- Attese: tutti true. Conferma struttura idempotente e assenza SQL dinamico.
with function_definition as (
  select
    pg_catalog.pg_get_functiondef(routine.oid) as definition,
    routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,text,text,time without time zone,text)'
  )
)
select
  definition ilike '%security definer%' as security_definer_declared,
  definition ilike '%set search_path to %' as search_path_is_configured,
  source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as transaction_lock_present,
  source_code ilike '%pg_catalog.hashtextextended(%'
    as lock_uses_idempotency_key_hash,
  source_code ilike '%where existing_order.idempotency_key = p_idempotency_key%'
    as existing_order_lookup_present,
  source_code ilike '%v_existing_fingerprint <> p_request_fingerprint%'
    as fingerprint_comparison_present,
  source_code ilike '%IDEMPOTENCY_CONFLICT%'
    as controlled_conflict_present,
  source_code ilike '%idempotency_key,%request_fingerprint%'
    or (
      source_code ilike '%idempotency_key%'
      and source_code ilike '%request_fingerprint%'
    ) as idempotency_fields_inserted,
  source_code not ilike '%service_role%' as no_service_role_reference,
  source_code !~* '\mexecute\M' as no_dynamic_execute,
  source_code not ilike '%format(%' as no_dynamic_format,
  source_code not ilike '%pgcrypto%' as no_pgcrypto_dependency
from function_definition;

-- Attese: RLS attiva e nessun privilegio diretto anon sulle tabelle ordini.
select
  protected_table.relname as table_name,
  protected_table.relrowsecurity as row_security_enabled,
  pg_catalog.has_table_privilege(
    'anon', protected_table.oid, 'SELECT'
  ) as anon_can_select,
  pg_catalog.has_table_privilege(
    'anon', protected_table.oid, 'INSERT'
  ) as anon_can_insert,
  pg_catalog.has_table_privilege(
    'anon', protected_table.oid, 'UPDATE'
  ) as anon_can_update,
  pg_catalog.has_table_privilege(
    'anon', protected_table.oid, 'DELETE'
  ) as anon_can_delete
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'public'
  and protected_table.relname in ('orders', 'order_items')
order by protected_table.relname;

-- Controllo informativo: le policy esistenti devono restare presenti.
select
  policy_definition.tablename,
  policy_definition.policyname,
  policy_definition.cmd,
  policy_definition.roles
from pg_catalog.pg_policies as policy_definition
where
  policy_definition.schemaname = 'public'
  and policy_definition.tablename in ('orders', 'order_items')
order by policy_definition.tablename, policy_definition.policyname;
