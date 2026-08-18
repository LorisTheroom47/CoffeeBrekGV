-- Coffee Break Monza
-- Schema degli ordini con consegna e ritiro.
-- Migrazione predisposta per revisione e applicazione manuale.
--
-- Strategia B: nessun INSERT anon diretto. Senza identità cliente e senza una
-- transazione SQL controllata, RLS da sola non può associare in modo robusto
-- le righe esclusivamente all'ordine appena creato né verificare gli importi.

begin;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  fulfillment_type text not null,
  status text not null default 'new',
  customer_name text not null,
  customer_phone text not null,
  customer_email text null,
  delivery_address text null,
  delivery_city text null,
  delivery_postal_code text null,
  requested_date date not null,
  requested_time time null,
  customer_notes text null,
  admin_notes text null,
  subtotal numeric(10, 2) not null,
  delivery_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  payment_method text not null default 'on_delivery',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_order_number_key unique (order_number),
  constraint orders_fulfillment_type_valid
    check (fulfillment_type in ('delivery', 'pickup')),
  constraint orders_status_valid
    check (
      status in (
        'new',
        'confirmed',
        'preparing',
        'ready',
        'out_for_delivery',
        'completed',
        'cancelled'
      )
    ),
  constraint orders_payment_method_valid
    check (payment_method in ('on_delivery', 'on_pickup')),
  constraint orders_customer_name_not_blank
    check (btrim(customer_name) <> ''),
  constraint orders_customer_phone_not_blank
    check (btrim(customer_phone) <> ''),
  constraint orders_customer_email_not_blank
    check (customer_email is null or btrim(customer_email) <> ''),
  constraint orders_fulfillment_details_valid
    check (
      (
        fulfillment_type = 'delivery'
        and delivery_address is not null
        and btrim(delivery_address) <> ''
        and delivery_city is not null
        and btrim(delivery_city) <> ''
        and delivery_postal_code is not null
        and btrim(delivery_postal_code) <> ''
        and payment_method = 'on_delivery'
      )
      or
      (
        fulfillment_type = 'pickup'
        and delivery_address is null
        and delivery_city is null
        and delivery_postal_code is null
        and payment_method = 'on_pickup'
      )
    ),
  constraint orders_subtotal_non_negative
    check (subtotal >= 0),
  constraint orders_delivery_fee_non_negative
    check (delivery_fee >= 0),
  constraint orders_total_non_negative
    check (total >= 0),
  constraint orders_total_matches_components
    check (total = subtotal + delivery_fee)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  menu_item_id uuid null,
  item_name text not null,
  unit_price numeric(10, 2) not null,
  quantity integer not null,
  line_total numeric(10, 2) not null,
  customer_notes text null,
  created_at timestamptz not null default now(),
  constraint order_items_order_id_fkey
    foreign key (order_id)
    references public.orders (id)
    on update cascade
    on delete cascade,
  constraint order_items_menu_item_id_fkey
    foreign key (menu_item_id)
    references public.menu_items (id)
    on update cascade
    on delete set null,
  constraint order_items_item_name_not_blank
    check (btrim(item_name) <> ''),
  constraint order_items_unit_price_non_negative
    check (unit_price >= 0),
  constraint order_items_quantity_positive
    check (quantity > 0),
  constraint order_items_line_total_non_negative
    check (line_total >= 0),
  constraint order_items_line_total_matches_quantity
    check (line_total = unit_price * quantity)
);

drop trigger if exists orders_set_updated_at
  on public.orders;

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at);

create index if not exists orders_requested_date_time_idx
  on public.orders (requested_date, requested_time);

create index if not exists orders_fulfillment_date_idx
  on public.orders (fulfillment_type, requested_date);

-- Il telefono è indicizzato soltanto per la ricerca operativa amministrativa.
-- È un dato personale e non è esposto da alcuna policy di lettura pubblica.
create index if not exists orders_customer_phone_idx
  on public.orders (customer_phone);

create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

create index if not exists order_items_menu_item_id_idx
  on public.order_items (menu_item_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all privileges
  on table
    public.orders,
    public.order_items
  from public, anon, authenticated;

revoke all privileges
  on sequence public.orders_order_number_seq
  from public, anon, authenticated;

grant select, insert, update, delete
  on table
    public.orders,
    public.order_items
  to authenticated;

grant usage
  on sequence public.orders_order_number_seq
  to authenticated;

drop policy if exists orders_select_admin
  on public.orders;

create policy orders_select_admin
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists orders_insert_admin
  on public.orders;

create policy orders_insert_admin
on public.orders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists orders_update_admin
  on public.orders;

create policy orders_update_admin
on public.orders
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

drop policy if exists orders_delete_admin
  on public.orders;

create policy orders_delete_admin
on public.orders
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists order_items_select_admin
  on public.order_items;

create policy order_items_select_admin
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists order_items_insert_admin
  on public.order_items;

create policy order_items_insert_admin
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists order_items_update_admin
  on public.order_items;

create policy order_items_update_admin
on public.order_items
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

drop policy if exists order_items_delete_admin
  on public.order_items;

create policy order_items_delete_admin
on public.order_items
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
