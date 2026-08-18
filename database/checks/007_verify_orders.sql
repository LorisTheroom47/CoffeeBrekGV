-- Coffee Break Monza
-- Controlli di sola lettura per ordini e righe ordine.
-- Eseguire soltanto dopo l'applicazione manuale della migrazione 007.

-- Attese: due righe, orders e order_items.
select table_name
from information_schema.tables
where
  table_schema = 'public'
  and table_name in ('orders', 'order_items')
order by table_name;

-- Attese: colonne, tipi, nullabilità e default conformi alla migrazione 007.
-- order_number deve mostrare is_identity = YES e identity_generation = ALWAYS.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  is_identity,
  identity_generation,
  numeric_precision,
  numeric_scale
from information_schema.columns
where
  table_schema = 'public'
  and table_name in ('orders', 'order_items')
order by table_name, ordinal_position;

-- Attese:
-- primary key UUID su id per entrambe le tabelle;
-- vincolo UNIQUE su orders.order_number.
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
  and table_constraint.table_name in ('orders', 'order_items')
  and table_constraint.constraint_type in ('PRIMARY KEY', 'UNIQUE')
order by
  table_constraint.table_name,
  table_constraint.constraint_type,
  key_column.ordinal_position;

-- Attesi: tutti i CHECK su tipologia, stato, pagamento, dati consegna,
-- importi, nome piatto e quantità.
select
  table_name,
  constraint_name,
  check_clause
from information_schema.check_constraints
join information_schema.constraint_table_usage
  using (constraint_catalog, constraint_schema, constraint_name)
where
  constraint_schema = 'public'
  and table_name in ('orders', 'order_items')
order by table_name, constraint_name;

-- Attese:
-- order_id -> orders(id), UPDATE CASCADE, DELETE CASCADE;
-- menu_item_id -> menu_items(id), UPDATE CASCADE, DELETE SET NULL.
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
  and source_column.table_name = 'order_items'
order by source_column.column_name;

-- Attesa: un trigger BEFORE UPDATE su orders che usa set_updated_at().
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where
  trigger_schema = 'public'
  and trigger_name = 'orders_set_updated_at';

-- Attese: gli indici richiesti, oltre a primary key e unique order_number.
select
  tablename,
  indexname,
  indexdef
from pg_catalog.pg_indexes
where
  schemaname = 'public'
  and tablename in ('orders', 'order_items')
order by tablename, indexname;

-- Attese: row_security_enabled = true per entrambe le tabelle.
select
  table_name.relname as table_name,
  table_name.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as table_name
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_name.relnamespace
where
  schema_name.nspname = 'public'
  and table_name.relname in ('orders', 'order_items')
order by table_name.relname;

-- Attese per ogni tabella: policy admin separate per SELECT, INSERT,
-- UPDATE e DELETE; nessuna policy ALL e nessuna policy anon.
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
  and tablename in ('orders', 'order_items')
order by tablename, cmd, policyname;

-- Attesi per ogni tabella: SELECT = 1, INSERT = 1, UPDATE = 1,
-- DELETE = 1, ALL = 0 e policy anon = 0.
select
  tablename,
  count(*) filter (where cmd = 'SELECT') as select_policy_count,
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count,
  count(*) filter (where cmd = 'ALL') as all_policy_count,
  count(*) filter (where 'anon' = any (roles)) as anon_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('orders', 'order_items')
group by tablename
order by tablename;

-- Attese: zero policy authenticated prive del controllo admin_users.
-- Questo conferma strutturalmente che un authenticated non-admin è bloccato.
select
  count(*) filter (
    where
      'authenticated' = any (roles)
      and concat_ws(' ', qual, with_check) not like '%admin_users%'
  ) as non_admin_authenticated_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('orders', 'order_items');

-- Attese:
-- anon: nessun privilegio;
-- authenticated: SELECT, INSERT, UPDATE e DELETE;
-- TRUNCATE, REFERENCES e TRIGGER devono essere false.
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
  (values ('orders'), ('order_items')) as tables(table_name)
order by role_name, table_name;

-- Attesa: PUBLIC non possiede alcun privilegio sulle nuove tabelle.
select
  count(*) as public_privilege_count
from information_schema.table_privileges
where
  table_schema = 'public'
  and table_name in ('orders', 'order_items')
  and grantee = 'PUBLIC';

-- Attese: anon non possiede privilegi sulla sequenza identity;
-- authenticated possiede USAGE per generare order_number lato admin.
select
  role_name,
  has_sequence_privilege(
    role_name,
    'public.orders_order_number_seq',
    'USAGE'
  ) as can_use_order_number_sequence
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Attese: nessun riferimento a service_role, UUID o dati cliente hardcoded
-- nelle espressioni delle policy.
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
    where concat_ws(' ', qual, with_check)
      ~* '(@|customer_email|customer_phone|delivery_address)'
  ) as personal_data_reference_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('orders', 'order_items');

-- Attesi: entrambi i conteggi pari a zero subito dopo la migrazione.
-- Con tabelle vuote non sono presenti nomi, telefoni, email o indirizzi reali.
select
  (select count(*) from public.orders) as order_count,
  (select count(*) from public.order_items) as order_item_count;
