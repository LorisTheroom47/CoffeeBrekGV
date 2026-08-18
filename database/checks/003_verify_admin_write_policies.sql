-- Coffee Break Monza
-- Controlli di sola lettura per le policy amministrative di scrittura.
-- Eseguire soltanto dopo l'applicazione manuale della migrazione 003.

-- Attese: due righe con row_security_enabled = true.
select
  table_name.relname as table_name,
  table_name.relrowsecurity as row_security_enabled
from pg_catalog.pg_class as table_name
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = table_name.relnamespace
where
  schema_name.nspname = 'public'
  and table_name.relname in ('menu_items', 'menu_item_allergens')
order by table_name.relname;

-- Attese: le quattro policy SELECT pubbliche originali, due per tabella.
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
  and policyname in (
    'menu_items_select_anon',
    'menu_items_select_authenticated',
    'menu_item_allergens_select_anon',
    'menu_item_allergens_select_authenticated'
  )
order by tablename, policyname;

-- Attese:
-- menu_items: INSERT, UPDATE e DELETE;
-- menu_item_allergens: INSERT e DELETE, senza UPDATE;
-- tutte le policy devono avere esclusivamente il ruolo authenticated.
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
  and policyname in (
    'menu_items_insert_admin',
    'menu_items_update_admin',
    'menu_items_delete_admin',
    'menu_item_allergens_insert_admin',
    'menu_item_allergens_delete_admin'
  )
order by tablename, cmd, policyname;

-- Attese:
-- menu_items: 1 INSERT, 1 UPDATE, 1 DELETE;
-- menu_item_allergens: 1 INSERT, 0 UPDATE, 1 DELETE.
select
  tablename,
  count(*) filter (where cmd = 'INSERT') as insert_policy_count,
  count(*) filter (where cmd = 'UPDATE') as update_policy_count,
  count(*) filter (where cmd = 'DELETE') as delete_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('menu_items', 'menu_item_allergens')
group by tablename
order by tablename;

-- Attese:
-- anon: soltanto SELECT su entrambe le tabelle;
-- authenticated: SELECT, INSERT, UPDATE e DELETE su menu_items;
-- authenticated: SELECT, INSERT e DELETE su menu_item_allergens;
-- TRUNCATE, REFERENCES e TRIGGER devono essere false per entrambi i ruoli.
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
  (values ('menu_items'), ('menu_item_allergens')) as tables(table_name)
order by role_name, table_name;

-- Attese: soltanto i grants descritti nel controllo precedente.
select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where
  table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in ('menu_items', 'menu_item_allergens')
order by grantee, table_name, privilege_type;

-- Attesa: public_write_grant_count = 0.
select
  count(*) as public_write_grant_count
from information_schema.table_privileges
where
  table_schema = 'public'
  and grantee = 'PUBLIC'
  and table_name in ('menu_items', 'menu_item_allergens')
  and privilege_type in (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  );

-- Attesa: zero policy di scrittura su categories, allergens e settings.
select
  target_table.table_name,
  count(policy.policyname) as write_policy_count
from
  (
    values
      ('categories'),
      ('allergens'),
      ('settings')
  ) as target_table(table_name)
left join pg_catalog.pg_policies as policy
  on policy.schemaname = 'public'
  and policy.tablename = target_table.table_name
  and policy.cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
group by target_table.table_name
order by target_table.table_name;

-- Attese: anon_write_policy_count = 0 e
-- non_admin_authenticated_policy_count = 0.
select
  count(*) filter (
    where 'anon' = any (roles)
  ) as anon_write_policy_count,
  count(*) filter (
    where
      'authenticated' = any (roles)
      and concat_ws(' ', qual, with_check) not like '%admin_users%'
  ) as non_admin_authenticated_policy_count
from pg_catalog.pg_policies
where
  schemaname = 'public'
  and tablename in ('menu_items', 'menu_item_allergens')
  and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

-- Attese: uuid_literal_count = 0 ed email_reference_count = 0.
select
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
  and policyname in (
    'menu_items_insert_admin',
    'menu_items_update_admin',
    'menu_items_delete_admin',
    'menu_item_allergens_insert_admin',
    'menu_item_allergens_delete_admin'
  );
