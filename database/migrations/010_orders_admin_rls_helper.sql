-- Coffee Break Monza
-- Helper RLS amministrativo compatibile con Supabase Realtime.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

create schema if not exists private;

-- La policy deve poter invocare l'helper, ma authenticated non deve poter
-- creare oggetti nello schema private. PUBLIC e anon non ricevono accesso.
revoke all privileges
  on schema private
  from public, anon, authenticated;

grant usage
  on schema private
  to authenticated;

-- SECURITY DEFINER con owner postgres consente di verificare admin_users
-- senza far dipendere la policy orders dalla RLS forzata della tabella.
-- L'identità resta sempre quella del JWT chiamante tramite auth.uid().
create or replace function private.is_admin()
returns pg_catalog.bool
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.admin_users as admin_user
    where admin_user.user_id = (select auth.uid())
  );
$function$;

alter function private.is_admin()
owner to postgres;

revoke all privileges
  on function private.is_admin()
  from public, anon, authenticated;

grant execute
  on function private.is_admin()
  to authenticated;

comment on function private.is_admin()
is 'Restituisce true soltanto quando auth.uid() appartiene a public.admin_users; helper privato per policy RLS.';

drop policy if exists orders_select_admin
  on public.orders;

create policy orders_select_admin
on public.orders
for select
to authenticated
using ((select private.is_admin()));

commit;
