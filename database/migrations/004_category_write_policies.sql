-- Coffee Break Monza
-- Policy amministrative per creare e modificare le categorie.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

-- Mantiene SELECT invariato e normalizza soltanto i privilegi di scrittura.
revoke insert, update, delete, truncate, references, trigger
  on table public.categories
  from public, anon, authenticated;

grant select
  on table public.categories
  to anon, authenticated;

grant insert, update
  on table public.categories
  to authenticated;

drop policy if exists categories_insert_admin
  on public.categories;

create policy categories_insert_admin
on public.categories
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists categories_update_admin
  on public.categories;

create policy categories_update_admin
on public.categories
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

commit;
