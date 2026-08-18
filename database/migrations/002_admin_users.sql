-- Coffee Break Monza
-- Elenco minimo degli utenti Supabase Auth autorizzabili come amministratori.
-- Migrazione predisposta per esecuzione manuale dopo revisione.

begin;

create table if not exists public.admin_users (
  user_id uuid not null primary key,
  created_at timestamptz not null default now(),
  constraint admin_users_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on update cascade
    on delete cascade
);

alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;

revoke all privileges
  on table public.admin_users
  from public, anon, authenticated;

grant select
  on table public.admin_users
  to authenticated;

drop policy if exists admin_users_select_own
  on public.admin_users;

create policy admin_users_select_own
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

commit;
