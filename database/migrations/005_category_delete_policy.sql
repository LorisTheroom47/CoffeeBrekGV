-- Coffee Break Monza
-- Policy amministrativa per eliminare categorie.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

-- Mantiene invariati SELECT, INSERT e UPDATE.
revoke delete
  on table public.categories
  from public, anon;

grant delete
  on table public.categories
  to authenticated;

drop policy if exists categories_delete_admin
  on public.categories;

create policy categories_delete_admin
on public.categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

commit;
