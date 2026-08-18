-- Coffee Break Monza
-- Schema dei menu programmati per data.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

create table if not exists public.daily_menus (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  status text not null default 'draft',
  title text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_menus_service_date_key unique (service_date),
  constraint daily_menus_status_valid
    check (status in ('draft', 'published')),
  constraint daily_menus_title_not_blank
    check (title is null or btrim(title) <> '')
);

create table if not exists public.daily_menu_items (
  daily_menu_id uuid not null,
  menu_item_id uuid not null,
  display_order integer not null default 0,
  available boolean not null default true,
  price_override numeric(10, 2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_menu_items_pkey
    primary key (daily_menu_id, menu_item_id),
  constraint daily_menu_items_daily_menu_id_fkey
    foreign key (daily_menu_id)
    references public.daily_menus (id)
    on update cascade
    on delete cascade,
  constraint daily_menu_items_menu_item_id_fkey
    foreign key (menu_item_id)
    references public.menu_items (id)
    on update cascade
    on delete restrict,
  constraint daily_menu_items_display_order_non_negative
    check (display_order >= 0),
  constraint daily_menu_items_price_override_non_negative
    check (price_override is null or price_override >= 0)
);

drop trigger if exists daily_menus_set_updated_at
  on public.daily_menus;

create trigger daily_menus_set_updated_at
before update on public.daily_menus
for each row
execute function public.set_updated_at();

drop trigger if exists daily_menu_items_set_updated_at
  on public.daily_menu_items;

create trigger daily_menu_items_set_updated_at
before update on public.daily_menu_items
for each row
execute function public.set_updated_at();

-- Il vincolo UNIQUE su service_date crea già l'indice necessario per la data.
create index if not exists daily_menus_status_service_date_idx
  on public.daily_menus (status, service_date);

create index if not exists daily_menu_items_menu_order_idx
  on public.daily_menu_items (daily_menu_id, display_order);

create index if not exists daily_menu_items_menu_item_id_idx
  on public.daily_menu_items (menu_item_id);

alter table public.daily_menus enable row level security;
alter table public.daily_menu_items enable row level security;

revoke all privileges
  on table
    public.daily_menus,
    public.daily_menu_items
  from public, anon, authenticated;

grant select
  on table
    public.daily_menus,
    public.daily_menu_items
  to anon, authenticated;

grant insert, update, delete
  on table
    public.daily_menus,
    public.daily_menu_items
  to authenticated;

drop policy if exists daily_menus_select_published_anon
  on public.daily_menus;

create policy daily_menus_select_published_anon
on public.daily_menus
for select
to anon
using (status = 'published');

drop policy if exists daily_menus_select_published_authenticated
  on public.daily_menus;

create policy daily_menus_select_published_authenticated
on public.daily_menus
for select
to authenticated
using (status = 'published');

drop policy if exists daily_menus_select_admin
  on public.daily_menus;

create policy daily_menus_select_admin
on public.daily_menus
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists daily_menu_items_select_published_anon
  on public.daily_menu_items;

create policy daily_menu_items_select_published_anon
on public.daily_menu_items
for select
to anon
using (
  exists (
    select 1
    from public.daily_menus
    where
      daily_menus.id = daily_menu_items.daily_menu_id
      and daily_menus.status = 'published'
  )
);

drop policy if exists daily_menu_items_select_published_authenticated
  on public.daily_menu_items;

create policy daily_menu_items_select_published_authenticated
on public.daily_menu_items
for select
to authenticated
using (
  exists (
    select 1
    from public.daily_menus
    where
      daily_menus.id = daily_menu_items.daily_menu_id
      and daily_menus.status = 'published'
  )
);

drop policy if exists daily_menu_items_select_admin
  on public.daily_menu_items;

create policy daily_menu_items_select_admin
on public.daily_menu_items
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists daily_menus_insert_admin
  on public.daily_menus;

create policy daily_menus_insert_admin
on public.daily_menus
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists daily_menus_update_admin
  on public.daily_menus;

create policy daily_menus_update_admin
on public.daily_menus
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

drop policy if exists daily_menus_delete_admin
  on public.daily_menus;

create policy daily_menus_delete_admin
on public.daily_menus
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists daily_menu_items_insert_admin
  on public.daily_menu_items;

create policy daily_menu_items_insert_admin
on public.daily_menu_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists daily_menu_items_update_admin
  on public.daily_menu_items;

create policy daily_menu_items_update_admin
on public.daily_menu_items
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

drop policy if exists daily_menu_items_delete_admin
  on public.daily_menu_items;

create policy daily_menu_items_delete_admin
on public.daily_menu_items
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
