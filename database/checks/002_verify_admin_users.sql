-- Coffee Break Monza
-- Controlli di sola lettura per admin_users.

-- Attesa: una riga con table_name = admin_users.
select table_name
from information_schema.tables
where
  table_schema = 'public'
  and table_name = 'admin_users';

-- Attese:
-- user_id: uuid, non nullable;
-- created_at: timestamptz, non nullable, default now().
select
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where
  table_schema = 'public'
  and table_name = 'admin_users'
  and column_name in ('user_id', 'created_at')
order by ordinal_position;

-- Attesa: una primary key composta soltanto da user_id.
select
  table_constraint.constraint_name,
  table_constraint.constraint_type,
  key_column.column_name
from information_schema.table_constraints as table_constraint
join information_schema.key_column_usage as key_column
  on key_column.constraint_schema = table_constraint.constraint_schema
  and key_column.constraint_name = table_constraint.constraint_name
where
  table_constraint.table_schema = 'public'
  and table_constraint.table_name = 'admin_users'
  and table_constraint.constraint_type = 'PRIMARY KEY'
order by key_column.ordinal_position;

-- Attesa: user_id riferisce auth.users(id), con UPDATE e DELETE CASCADE.
select
  source_column.constraint_name,
  source_column.column_name,
  target_column.table_schema as foreign_table_schema,
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
  and source_column.table_name = 'admin_users'
  and source_column.column_name = 'user_id';

-- Attesa: row_security_enabled = true.
select
  table_name.relname as table_name,
  table_name.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as table_name
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_name.relnamespace
where
  schema_name.nspname = 'public'
  and table_name.relname = 'admin_users';

-- Attesa: una sola policy, SELECT per authenticated, limitata ad auth.uid().
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'admin_users'
order by policyname;

-- Attese: 1 SELECT; 0 INSERT; 0 UPDATE; 0 DELETE.
select
  count(*) filter (where cmd = 'SELECT') as select_policy_count,
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'admin_users';

-- Attese:
-- anon: nessun privilegio;
-- authenticated: soltanto SELECT.
select
  role_name,
  has_table_privilege(role_name, 'public.admin_users', 'SELECT') as can_select,
  has_table_privilege(role_name, 'public.admin_users', 'INSERT') as can_insert,
  has_table_privilege(role_name, 'public.admin_users', 'UPDATE') as can_update,
  has_table_privilege(role_name, 'public.admin_users', 'DELETE') as can_delete,
  has_table_privilege(role_name, 'public.admin_users', 'TRUNCATE') as can_truncate,
  has_table_privilege(role_name, 'public.admin_users', 'REFERENCES') as can_reference,
  has_table_privilege(role_name, 'public.admin_users', 'TRIGGER') as can_trigger
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Attesa: soltanto SELECT per authenticated; nessuna riga per anon.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where
  table_schema = 'public'
  and table_name = 'admin_users'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Attesa: 0 subito dopo la migrazione; 1 dopo l'associazione manuale prevista.
select count(*) as admin_user_count
from public.admin_users;
