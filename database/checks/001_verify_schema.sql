-- Coffee Break Monza
-- Controlli di sola lettura da eseguire dopo migrazione e seed.

-- Attese: cinque righe, una per ogni tabella applicativa.
select table_name
from information_schema.tables
where
  table_schema = 'public'
  and table_name in (
    'categories',
    'menu_items',
    'allergens',
    'menu_item_allergens',
    'settings'
  )
order by table_name;

-- Attese:
-- 4 categorie, 8 piatti, 7 disponibili, 1 non disponibile,
-- 14 allergeni e 3 impostazioni pubbliche.
select
  (select count(*) from public.categories) as category_count,
  (select count(*) from public.menu_items) as menu_item_count,
  (
    select count(*)
    from public.menu_items
    where available = true
  ) as available_menu_item_count,
  (
    select count(*)
    from public.menu_items
    where available = false
  ) as unavailable_menu_item_count,
  (select count(*) from public.allergens) as allergen_count,
  (
    select count(*)
    from public.settings
    where is_public = true
  ) as public_setting_count;

-- Attese: tre foreign key con le azioni di aggiornamento/eliminazione previste.
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
  and source_column.table_name in ('menu_items', 'menu_item_allergens')
order by source_column.table_name, source_column.column_name;

-- Attese: quattro trigger BEFORE UPDATE, uno per tabella con updated_at.
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where
  trigger_schema = 'public'
  and trigger_name in (
    'categories_set_updated_at',
    'menu_items_set_updated_at',
    'allergens_set_updated_at',
    'settings_set_updated_at'
  )
order by event_object_table;

-- Attese: row_security_enabled = true per tutte le cinque tabelle.
select
  table_name.relname as table_name,
  table_name.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as table_name
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_name.relnamespace
where
  schema_name.nspname = 'public'
  and table_name.relname in (
    'categories',
    'menu_items',
    'allergens',
    'menu_item_allergens',
    'settings'
  )
order by table_name.relname;

-- Attese: dieci policy SELECT, separate per anon e authenticated.
-- Le policy di settings devono mostrare la condizione is_public = true.
select
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in (
    'categories',
    'menu_items',
    'allergens',
    'menu_item_allergens',
    'settings'
  )
order by tablename, policyname;

-- Attese: esclusivamente SELECT per anon e authenticated sulle cinque tabelle.
-- Non devono comparire INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES o TRIGGER.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where
  table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'categories',
    'menu_items',
    'allergens',
    'menu_item_allergens',
    'settings'
  )
order by grantee, table_name, privilege_type;

-- Attese: gli indici espliciti richiesti e gli indici creati dai vincoli.
select
  tablename,
  indexname,
  indexdef
from pg_catalog.pg_indexes
where
  schemaname = 'public'
  and tablename in (
    'categories',
    'menu_items',
    'allergens',
    'menu_item_allergens',
    'settings'
  )
order by tablename, indexname;

-- Attese: categorie e piatti nell'ordine definito nel seed.
select
  category.display_order as category_order,
  category.name as category_name,
  menu_item.display_order as item_order,
  menu_item.name as item_name,
  menu_item.price,
  menu_item.available
from public.categories as category
left join public.menu_items as menu_item
  on menu_item.category_id = category.id
order by
  category.display_order,
  category.name,
  menu_item.display_order,
  menu_item.name;
