-- Coffee Break Monza
-- Schema iniziale, vincoli, indici, trigger, RLS e privilegi di sola lettura.
-- Progettato per un database Supabase nuovo.

begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_not_blank check (btrim(name) <> ''),
  constraint categories_slug_not_blank check (btrim(slug) <> ''),
  constraint categories_slug_key unique (slug),
  constraint categories_display_order_non_negative check (display_order >= 0)
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null,
  name text not null,
  description text null,
  price numeric(10, 2) not null,
  available boolean not null default true,
  display_order integer not null default 0,
  image_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_category_id_fkey
    foreign key (category_id)
    references public.categories (id)
    on update cascade
    on delete restrict,
  constraint menu_items_name_not_blank check (btrim(name) <> ''),
  constraint menu_items_price_non_negative check (price >= 0),
  constraint menu_items_display_order_non_negative check (display_order >= 0),
  constraint menu_items_image_url_not_blank
    check (image_url is null or btrim(image_url) <> '')
);

create table public.allergens (
  id uuid primary key default gen_random_uuid(),
  code smallint not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allergens_code_key unique (code),
  constraint allergens_code_valid check (code between 1 and 14),
  constraint allergens_name_not_blank check (btrim(name) <> ''),
  constraint allergens_name_key unique (name)
);

create table public.menu_item_allergens (
  menu_item_id uuid not null,
  allergen_id uuid not null,
  created_at timestamptz not null default now(),
  constraint menu_item_allergens_pkey
    primary key (menu_item_id, allergen_id),
  constraint menu_item_allergens_menu_item_id_fkey
    foreign key (menu_item_id)
    references public.menu_items (id)
    on update cascade
    on delete cascade,
  constraint menu_item_allergens_allergen_id_fkey
    foreign key (allergen_id)
    references public.allergens (id)
    on update cascade
    on delete cascade
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  description text null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_key_not_blank check (btrim(key) <> ''),
  constraint settings_key_key unique (key)
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all privileges
  on function public.set_updated_at()
  from public, anon, authenticated;

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row
execute function public.set_updated_at();

create trigger allergens_set_updated_at
before update on public.allergens
for each row
execute function public.set_updated_at();

create trigger settings_set_updated_at
before update on public.settings
for each row
execute function public.set_updated_at();

create index categories_display_order_name_idx
  on public.categories (display_order, name);

create index menu_items_category_display_order_name_idx
  on public.menu_items (category_id, display_order, name);

create index menu_items_available_idx
  on public.menu_items (available);

-- Nessun indice aggiuntivo su allergens(code): il vincolo UNIQUE crea già
-- un indice B-tree utilizzabile per le ricerche per codice.

create index menu_item_allergens_allergen_id_idx
  on public.menu_item_allergens (allergen_id);

create index settings_is_public_idx
  on public.settings (is_public);

alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.allergens enable row level security;
alter table public.menu_item_allergens enable row level security;
alter table public.settings enable row level security;

revoke all privileges
  on table
    public.categories,
    public.menu_items,
    public.allergens,
    public.menu_item_allergens,
    public.settings
  from anon, authenticated;

grant select
  on table
    public.categories,
    public.menu_items,
    public.allergens,
    public.menu_item_allergens,
    public.settings
  to anon, authenticated;

create policy categories_select_anon
on public.categories
for select
to anon
using (true);

create policy categories_select_authenticated
on public.categories
for select
to authenticated
using (true);

create policy menu_items_select_anon
on public.menu_items
for select
to anon
using (true);

create policy menu_items_select_authenticated
on public.menu_items
for select
to authenticated
using (true);

create policy allergens_select_anon
on public.allergens
for select
to anon
using (true);

create policy allergens_select_authenticated
on public.allergens
for select
to authenticated
using (true);

create policy menu_item_allergens_select_anon
on public.menu_item_allergens
for select
to anon
using (true);

create policy menu_item_allergens_select_authenticated
on public.menu_item_allergens
for select
to authenticated
using (true);

create policy settings_select_anon
on public.settings
for select
to anon
using (is_public = true);

create policy settings_select_authenticated
on public.settings
for select
to authenticated
using (is_public = true);

commit;
