-- Coffee Break Monza
-- Controlli di sola lettura per i menu programmati per data.
-- Eseguire soltanto dopo l'applicazione manuale della migrazione 006.

-- Attese: due righe, daily_menus e daily_menu_items.
select table_name
from information_schema.tables
where
  table_schema = 'public'
  and table_name in ('daily_menus', 'daily_menu_items')
order by table_name;

-- Attese: colonne, tipi, nullabilità e default conformi alla migrazione 006.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  numeric_precision,
  numeric_scale
from information_schema.columns
where
  table_schema = 'public'
  and table_name in ('daily_menus', 'daily_menu_items')
order by table_name, ordinal_position;

-- Attese:
-- daily_menus: primary key su id e unique su service_date;
-- daily_menu_items: primary key composta da daily_menu_id e menu_item_id.
select
  table_constraint.table_name,
  table_constraint.constraint_name,
  table_constraint.constraint_type,
  key_column.column_name,
  key_column.ordinal_position
from information_schema.table_constraints as table_constraint
join information_schema.key_column_usage as key_column
  on key_column.constraint_schema = table_constraint.constraint_schema
  and key_column.constraint_name = table_constraint.constraint_name
where
  table_constraint.table_schema = 'public'
  and table_constraint.table_name in ('daily_menus', 'daily_menu_items')
  and table_constraint.constraint_type in ('PRIMARY KEY', 'UNIQUE')
order by
  table_constraint.table_name,
  table_constraint.constraint_type,
  key_column.ordinal_position;

-- Attese:
-- status accetta soltanto draft e published;
-- title non può essere vuoto dopo trim;
-- display_order è non negativo;
-- price_override è null oppure non negativo.
select
  table_name,
  constraint_name,
  check_clause
from information_schema.check_constraints
join information_schema.constraint_table_usage
  using (constraint_catalog, constraint_schema, constraint_name)
where
  constraint_schema = 'public'
  and table_name in ('daily_menus', 'daily_menu_items')
order by table_name, constraint_name;

-- Attese:
-- daily_menu_id -> daily_menus(id), UPDATE CASCADE, DELETE CASCADE;
-- menu_item_id -> menu_items(id), UPDATE CASCADE, DELETE RESTRICT.
select
  source_column.constraint_name,
  source_column.table_name,
  source_column.column_name,
  target_column.table_name as foreign_table_name,
  target_column.column_name as foreign_column_name,
  referential.update_rule,
  referential.delete_rule
from information_schema.referential_constraints as referential
join information_schema.key_column_usage as source_column
  on source_column.constraint_schema = referential.constraint_schema
  and source_column.constraint_name = referential.constraint_name
join information_schema.constraint_column_usage as target_column
  on target_column.constraint_schema = referential.unique_constraint_schema
  and target_column.constraint_name = referential.unique_constraint_name
where
  referential.constraint_schema = 'public'
  and source_column.table_name = 'daily_menu_items'
order by source_column.column_name;

-- Attese: due trigger BEFORE UPDATE che riutilizzano public.set_updated_at().
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where
  trigger_schema = 'public'
  and trigger_name in (
    'daily_menus_set_updated_at',
    'daily_menu_items_set_updated_at'
  )
order by event_object_table;

-- Attese: row_security_enabled = true per entrambe le tabelle.
select
  table_name.relname as table_name,
  table_name.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as table_name
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_name.relnamespace
where
  schema_name.nspname = 'public'
  and table_name.relname in ('daily_menus', 'daily_menu_items')
order by table_name.relname;

-- Attese per ogni tabella:
-- una SELECT published per anon, una SELECT published per authenticated,
-- una SELECT admin e policy admin separate per INSERT, UPDATE e DELETE.
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('daily_menus', 'daily_menu_items')
order by tablename, cmd, policyname;

-- Attese: due policy published e una admin per ogni tabella.
select
  tablename,
  count(*) filter (
    where cmd = 'SELECT' and policyname like '%published%'
  ) as published_select_policy_count,
  count(*) filter (
    where cmd = 'SELECT' and policyname like '%admin%'
  ) as admin_select_policy_count,
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count,
  count(*) filter (where cmd = 'ALL') as all_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('daily_menus', 'daily_menu_items')
group by tablename
order by tablename;

-- Attese: le policy pubbliche filtrano esclusivamente status = published.
-- Per daily_menu_items il filtro passa dalla daily_menus collegata.
select
  tablename,
  policyname,
  roles,
  qual
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('daily_menus', 'daily_menu_items')
  and policyname like '%select_published%'
order by tablename, policyname;

-- Attese: tutte le policy amministrative verificano public.admin_users.
select
  count(*) filter (
    where concat_ws(' ', qual, with_check) not like '%admin_users%'
  ) as admin_policy_without_admin_check_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('daily_menus', 'daily_menu_items')
  and policyname like '%admin%';

-- Attese:
-- anon: soltanto SELECT;
-- authenticated: SELECT, INSERT, UPDATE e DELETE;
-- nessun ruolo possiede TRUNCATE, REFERENCES o TRIGGER.
select
  role_name,
  table_name,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'SELECT'
  ) as can_select,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'INSERT'
  ) as can_insert,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'UPDATE'
  ) as can_update,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'DELETE'
  ) as can_delete,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'TRUNCATE'
  ) as can_truncate,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'REFERENCES'
  ) as can_reference,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    'TRIGGER'
  ) as can_trigger
from
  (values ('anon'), ('authenticated')) as roles(role_name)
cross join
  (values ('daily_menus'), ('daily_menu_items')) as tables(table_name)
order by role_name, table_name;

-- Attesa: public_privilege_count = 0.
select
  count(*) as public_privilege_count
from information_schema.table_privileges
where
  table_schema = 'public'
  and table_name in ('daily_menus', 'daily_menu_items')
  and grantee = 'PUBLIC';

-- Attese: nessun riferimento a service_role, UUID o email nelle policy.
select
  count(*) filter (
    where
      'service_role' = any (roles)
      or concat_ws(' ', qual, with_check) ~* 'service_role'
  ) as service_role_reference_count,
  count(*) filter (
    where concat_ws(' ', qual, with_check)
      ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  ) as uuid_literal_count,
  count(*) filter (
    where concat_ws(' ', qual, with_check) ~* 'email'
  ) as email_reference_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('daily_menus', 'daily_menu_items');

-- Attesi:
-- indice unique derivato da service_date;
-- indice status/service_date;
-- indice daily_menu_id/display_order;
-- indice menu_item_id;
-- indice della primary key composta.
select
  tablename,
  indexname,
  indexdef
from pg_catalog.pg_indexes
where
  schemaname = 'public'
  and tablename in ('daily_menus', 'daily_menu_items')
order by tablename, indexname;

-- Attesi: conteggi pari a zero subito dopo la migrazione.
select
  (select count(*) from public.daily_menus) as daily_menu_count,
  (select count(*) from public.daily_menu_items) as daily_menu_item_count;
