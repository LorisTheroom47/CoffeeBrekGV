-- Coffee Break Monza
-- Controlli di sola lettura per la policy DELETE sulle categorie.
-- Eseguire soltanto dopo l'applicazione manuale della migrazione 005.

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

-- Attesa: una policy DELETE per authenticated con controllo su admin_users.
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'categories'
  and policyname = 'categories_delete_admin';

-- Attese: SELECT, INSERT e UPDATE restano presenti; DELETE è aggiunta.
select
  policyname,
  roles,
  cmd
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'categories'
order by cmd, policyname;

-- Attese:
-- anon: nessun DELETE;
-- authenticated: DELETE disponibile e sottoposto a RLS.
select
  role_name,
  has_table_privilege(role_name, 'public.categories', 'SELECT') as can_select,
  has_table_privilege(role_name, 'public.categories', 'INSERT') as can_insert,
  has_table_privilege(role_name, 'public.categories', 'UPDATE') as can_update,
  has_table_privilege(role_name, 'public.categories', 'DELETE') as can_delete
from (values ('anon'), ('authenticated')) as roles(role_name)
order by role_name;

-- Attesa: public_delete_grant_count = 0.
select
  count(*) as public_delete_grant_count
from information_schema.table_privileges
where
  table_schema = 'public'
  and table_name = 'categories'
  and grantee = 'PUBLIC'
  and privilege_type = 'DELETE';

-- Attese: policy con controllo admin, senza UUID o riferimenti email.
select
  count(*) filter (
    where qual not like '%admin_users%'
  ) as policy_without_admin_check_count,
  count(*) filter (
    where qual
      ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  ) as uuid_literal_count,
  count(*) filter (
    where qual ~* 'email'
  ) as email_reference_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename = 'categories'
  and policyname = 'categories_delete_admin';
