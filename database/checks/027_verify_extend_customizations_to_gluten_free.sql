-- Coffee Break GV
-- Controlli read-only per la migrazione 027.
-- Non modifica schema, dati, policy o privilegi.

-- Atteso: una riga, boolean NOT NULL con default false.
select
  column_definition.column_name,
  column_definition.data_type = 'boolean' as type_is_boolean,
  column_definition.is_nullable = 'NO' as is_not_null,
  column_definition.column_default in ('false', 'false::boolean')
    as default_is_false
from information_schema.columns as column_definition
where column_definition.table_schema = 'public'
  and column_definition.table_name = 'menu_item_extras'
  and column_definition.column_name = 'applies_to_gluten_free';

-- Attesi: entrambi true. Il significato storico di applies_to resta invariato.
select
  pg_catalog.pg_get_constraintdef(table_constraint.oid) ilike '%PANINO%'
    and pg_catalog.pg_get_constraintdef(table_constraint.oid) ilike '%PIADINA%'
    and pg_catalog.pg_get_constraintdef(table_constraint.oid) ilike '%ENTRAMBI%'
    as existing_scopes_are_preserved,
  pg_catalog.pg_get_constraintdef(table_constraint.oid) not ilike '%SENZA_GLUTINE%'
    as gluten_free_scope_is_independent
from pg_catalog.pg_constraint as table_constraint
where table_constraint.conrelid = 'public.menu_item_extras'::pg_catalog.regclass
  and table_constraint.conname = 'menu_item_extras_applies_to_valid';

-- Attesi: firma invariata e un solo overload.
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

-- Attesi: tutti true. L'ambito senza glutine dipende dallo slug reale e dal
-- nuovo flag; ENTRAMBI continua a valere soltanto per Panini e Piadine.
with function_definition as (
  select routine.prosrc as source_code
  from pg_catalog.pg_proc as routine
  where routine.oid = pg_catalog.to_regprocedure(
    'public.create_public_order(text,text,text,date,jsonb,uuid,text,text,text,time without time zone,text)'
  )
)
select
  source_code ilike '%category.slug%''senzaglutine''%'
    and source_code ilike '%''SENZA_GLUTINE''::pg_catalog.text%'
    as gluten_free_slug_is_recognized,
  source_code ilike
    '%locked_menu_item.customization_scope = ''SENZA_GLUTINE''%'
    and source_code ilike
      '%menu_item_extra.applies_to_gluten_free = true%'
    as gluten_free_extra_must_be_enabled,
  source_code ilike
    '%locked_menu_item.customization_scope in (''PANINO'', ''PIADINA'')%'
    and source_code ilike '%''ENTRAMBI''%'
    as existing_scope_logic_is_preserved,
  source_code ilike '%locked_menu_item.customizable = true%'
    and source_code ilike '%menu_item_extra.available = true%'
    and source_code ilike '%menu_item_extra.price%'
    as customization_and_server_prices_are_preserved,
  source_code ilike '%for share of menu_item%'
    and source_code ilike '%for share of menu_item_extra%'
    as server_rows_remain_locked,
  source_code ilike '%coffee-break-extras-v1%'
    and source_code ilike '%pg_catalog.sha256(%'
    and source_code ilike '%pg_catalog.pg_advisory_xact_lock(%'
    as idempotency_is_preserved
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

-- Attesi: RLS e FORCE RLS restano attivi; le policy esistenti non cambiano.
select
  table_class.relrowsecurity as rls_enabled,
  table_class.relforcerowsecurity as rls_forced,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policy as policy
    where policy.polrelid = table_class.oid
  ) as policy_count
from pg_catalog.pg_class as table_class
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_class.relnamespace
where schema_name.nspname = 'public'
  and table_class.relname = 'menu_item_extras';
