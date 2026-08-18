-- Coffee Break Monza
-- Controlli di sola lettura per le policy di scrittura sulle categorie.
-- Eseguire soltanto dopo l'applicazione manuale della migrazione 004.

-- Attesa: una riga con row_security_enabled = true.
select
  table_name.relname as table_name,
  table_name.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as table_name
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_name.relnamespace
where
  schema_name.nspname = 'public'
  and table_name.relname = 'categories';

-- Attese: le due policy SELECT pubbliche originali.
select
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'categories'
  and policyname in (
    'categories_select_anon',
    'categories_select_authenticated'
  )
order by policyname;

-- Attese: una policy INSERT e una UPDATE, entrambe per authenticated.
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
  and tablename = 'categories'
  and policyname in (
    'categories_insert_admin',
    'categories_update_admin'
  )
order by cmd, policyname;

-- Attese: INSERT = 1, UPDATE = 1, DELETE = 0.
select
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'categories';

-- Attese:
-- anon: soltanto SELECT;
-- authenticated: SELECT, INSERT e UPDATE, senza DELETE o altri privilegi.
select
  role_name,
  has_table_privilege(role_name, 'public.categories', 'SELECT') as can_select,
  has_table_privilege(role_name, 'public.categories', 'INSERT') as can_insert,
  has_table_privilege(role_name, 'public.categories', 'UPDATE') as can_update,
  has_table_privilege(role_name, 'public.categories', 'DELETE') as can_delete,
  has_table_privilege(role_name, 'public.categories', 'TRUNCATE') as can_truncate,
  has_table_privilege(role_name, 'public.categories', 'REFERENCES') as can_reference,
  has_table_privilege(role_name, 'public.categories', 'TRIGGER') as can_trigger
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Attesa: public_write_grant_count = 0.
select
  count(*) as public_write_grant_count
from information_schema.table_privileges
where
  table_schema = 'public'
  and table_name = 'categories'
  and grantee = 'PUBLIC'
  and privilege_type in (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  );

-- Attese: entrambe le policy richiedono admin_users e non contengono UUID o email.
select
  count(*) filter (
    where concat_ws(' ', qual, with_check) not like '%admin_users%'
  ) as policy_without_admin_check_count,
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
  and tablename = 'categories'
  and policyname in (
    'categories_insert_admin',
    'categories_update_admin'
  );
