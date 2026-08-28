-- Coffee Break GV
-- Personalizzazione server-side di Panini e Piadine con massimo un extra
-- per ciascun gruppo FORMAGGIO, VERDURA e SALSA.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

alter table public.menu_items
  add column if not exists customizable pg_catalog.bool default false;

update public.menu_items
set customizable = false
where customizable is null;

alter table public.menu_items
  alter column customizable set default false,
  alter column customizable set not null;

comment on column public.menu_items.customizable
is 'Indica se il piatto può ricevere gli extra configurati per Panini o Piadine.';

create table if not exists public.menu_item_extras (
  id pg_catalog.uuid primary key default gen_random_uuid(),
  name pg_catalog.text not null,
  group_code pg_catalog.text not null,
  price pg_catalog.numeric(10, 2) not null default 0,
  available pg_catalog.bool not null default true,
  applies_to pg_catalog.text not null,
  display_order pg_catalog.int4 not null default 0,
  created_at pg_catalog.timestamptz not null default pg_catalog.now(),
  updated_at pg_catalog.timestamptz not null default pg_catalog.now(),
  constraint menu_item_extras_name_not_blank
    check (pg_catalog.btrim(name) <> ''),
  constraint menu_item_extras_group_code_valid
    check (group_code in ('FORMAGGIO', 'VERDURA', 'SALSA')),
  constraint menu_item_extras_price_non_negative
    check (price >= 0),
  constraint menu_item_extras_applies_to_valid
    check (applies_to in ('PANINO', 'PIADINA', 'ENTRAMBI')),
  constraint menu_item_extras_display_order_non_negative
    check (display_order >= 0)
);

drop trigger if exists menu_item_extras_set_updated_at
  on public.menu_item_extras;

create trigger menu_item_extras_set_updated_at
before update on public.menu_item_extras
for each row
execute function public.set_updated_at();

create index if not exists menu_item_extras_available_scope_order_idx
  on public.menu_item_extras (
    available,
    applies_to,
    group_code,
    display_order,
    name
  );

alter table public.menu_item_extras enable row level security;
alter table public.menu_item_extras force row level security;

revoke all privileges
  on table public.menu_item_extras
  from public, anon, authenticated;

grant select
  on table public.menu_item_extras
  to anon, authenticated;

grant insert, update, delete
  on table public.menu_item_extras
  to authenticated;

drop policy if exists menu_item_extras_select_anon
  on public.menu_item_extras;

create policy menu_item_extras_select_anon
on public.menu_item_extras
for select
to anon
using (available = true);

drop policy if exists menu_item_extras_select_authenticated
  on public.menu_item_extras;

create policy menu_item_extras_select_authenticated
on public.menu_item_extras
for select
to authenticated
using (
  available = true
  or (select private.is_admin())
);

drop policy if exists menu_item_extras_insert_admin
  on public.menu_item_extras;

create policy menu_item_extras_insert_admin
on public.menu_item_extras
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists menu_item_extras_update_admin
  on public.menu_item_extras;

create policy menu_item_extras_update_admin
on public.menu_item_extras
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists menu_item_extras_delete_admin
  on public.menu_item_extras;

create policy menu_item_extras_delete_admin
on public.menu_item_extras
for delete
to authenticated
using ((select private.is_admin()));

alter table public.order_items
  add column if not exists extras_unit_price
    pg_catalog.numeric(10, 2) default 0;

update public.order_items
set extras_unit_price = 0
where extras_unit_price is null;

alter table public.order_items
  alter column extras_unit_price set default 0,
  alter column extras_unit_price set not null;

alter table public.order_items
  drop constraint if exists order_items_extras_unit_price_non_negative;

alter table public.order_items
  add constraint order_items_extras_unit_price_non_negative
  check (extras_unit_price >= 0);

alter table public.order_items
  drop constraint if exists order_items_line_total_matches_quantity;

alter table public.order_items
  add constraint order_items_line_total_matches_quantity
  check (line_total = (unit_price + extras_unit_price) * quantity);

comment on column public.order_items.extras_unit_price
is 'Somma unitaria server-side dei sovrapprezzi selezionati sulla riga ordine.';

create table if not exists public.order_item_extras (
  id pg_catalog.uuid primary key default gen_random_uuid(),
  order_item_id pg_catalog.uuid not null,
  extra_id pg_catalog.uuid null,
  extra_name pg_catalog.text not null,
  group_code pg_catalog.text not null,
  extra_unit_price pg_catalog.numeric(10, 2) not null,
  created_at pg_catalog.timestamptz not null default pg_catalog.now(),
  constraint order_item_extras_order_item_id_fkey
    foreign key (order_item_id)
    references public.order_items (id)
    on update cascade
    on delete cascade,
  constraint order_item_extras_extra_id_fkey
    foreign key (extra_id)
    references public.menu_item_extras (id)
    on update cascade
    on delete set null,
  constraint order_item_extras_extra_name_not_blank
    check (pg_catalog.btrim(extra_name) <> ''),
  constraint order_item_extras_group_code_valid
    check (group_code in ('FORMAGGIO', 'VERDURA', 'SALSA')),
  constraint order_item_extras_extra_unit_price_non_negative
    check (extra_unit_price >= 0),
  constraint order_item_extras_order_item_group_key
    unique (order_item_id, group_code)
);

create index if not exists order_item_extras_order_item_id_idx
  on public.order_item_extras (order_item_id);

create index if not exists order_item_extras_extra_id_idx
  on public.order_item_extras (extra_id);

alter table public.order_item_extras enable row level security;
alter table public.order_item_extras force row level security;

revoke all privileges
  on table public.order_item_extras
  from public, anon, authenticated;

grant select
  on table public.order_item_extras
  to authenticated;

drop policy if exists order_item_extras_select_order_managers
  on public.order_item_extras;

create policy order_item_extras_select_order_managers
on public.order_item_extras
for select
to authenticated
using ((select private.can_manage_orders()));

create or replace function public.create_public_order(
  p_fulfillment_type pg_catalog.text,
  p_customer_name pg_catalog.text,
  p_customer_phone pg_catalog.text,
  p_requested_date pg_catalog.date,
  p_items pg_catalog.jsonb,
  p_idempotency_key pg_catalog.uuid,
  p_request_fingerprint pg_catalog.text,
  p_customer_email pg_catalog.text default null,
  p_delivery_point pg_catalog.text default null,
  p_requested_time pg_catalog.time default null,
  p_customer_notes pg_catalog.text default null
)
returns table (
  order_id pg_catalog.uuid,
  order_number pg_catalog.int8,
  total pg_catalog.numeric(10, 2)
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_delivery_fee constant pg_catalog.numeric(10, 2) := 0.00;
  v_customer_name pg_catalog.text;
  v_customer_phone pg_catalog.text;
  v_customer_email pg_catalog.text;
  v_delivery_point pg_catalog.text;
  v_customer_notes pg_catalog.text;
  v_payment_method pg_catalog.text;
  v_effective_delivery_fee pg_catalog.numeric(10, 2);
  v_item_count pg_catalog.int4;
  v_matched_item_count pg_catalog.int4;
  v_requested_extra_count pg_catalog.int4;
  v_matched_extra_count pg_catalog.int4;
  v_inserted_item_count pg_catalog.int4;
  v_inserted_extra_count pg_catalog.int4;
  v_validated_items pg_catalog.jsonb;
  v_normalized_extra_payload pg_catalog.jsonb;
  v_effective_request_fingerprint pg_catalog.text;
  v_subtotal pg_catalog.numeric;
  v_total pg_catalog.numeric;
  v_max_line_total pg_catalog.numeric;
  v_order_id pg_catalog.uuid;
  v_order_number pg_catalog.int8;
  v_existing_order_id pg_catalog.uuid;
  v_existing_order_number pg_catalog.int8;
  v_existing_total pg_catalog.numeric(10, 2);
  v_existing_fingerprint pg_catalog.text;
begin
  if p_idempotency_key is null
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if p_items is null
    or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);

  if v_item_count = 0 or v_item_count > 50 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
    where pg_catalog.jsonb_typeof(input_item.value) <> 'object'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
    cross join lateral
      pg_catalog.jsonb_object_keys(input_item.value) as input_key(key)
    where input_key.key not in (
      'menu_item_id',
      'quantity',
      'customer_notes',
      'cheese_extra_id',
      'vegetable_extra_id',
      'sauce_extra_id'
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
    where
      not (input_item.value ? 'menu_item_id')
      or pg_catalog.jsonb_typeof(input_item.value -> 'menu_item_id') <> 'string'
      or (input_item.value ->> 'menu_item_id')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not (input_item.value ? 'quantity')
      or pg_catalog.jsonb_typeof(input_item.value -> 'quantity') <> 'number'
      or (input_item.value ->> 'quantity') !~ '^[0-9]+$'
      or pg_catalog.char_length(input_item.value ->> 'quantity') > 2
      or (
        input_item.value ? 'customer_notes'
        and pg_catalog.jsonb_typeof(input_item.value -> 'customer_notes')
          not in ('string', 'null')
      )
      or pg_catalog.char_length(
        pg_catalog.btrim(input_item.value ->> 'customer_notes')
      ) > 500
      or (
        input_item.value ? 'cheese_extra_id'
        and (
          pg_catalog.jsonb_typeof(input_item.value -> 'cheese_extra_id')
            not in ('string', 'null')
          or (
            pg_catalog.jsonb_typeof(input_item.value -> 'cheese_extra_id') = 'string'
            and (input_item.value ->> 'cheese_extra_id')
              !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        )
      )
      or (
        input_item.value ? 'vegetable_extra_id'
        and (
          pg_catalog.jsonb_typeof(input_item.value -> 'vegetable_extra_id')
            not in ('string', 'null')
          or (
            pg_catalog.jsonb_typeof(input_item.value -> 'vegetable_extra_id') = 'string'
            and (input_item.value ->> 'vegetable_extra_id')
              !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        )
      )
      or (
        input_item.value ? 'sauce_extra_id'
        and (
          pg_catalog.jsonb_typeof(input_item.value -> 'sauce_extra_id')
            not in ('string', 'null')
          or (
            pg_catalog.jsonb_typeof(input_item.value -> 'sauce_extra_id') = 'string'
            and (input_item.value ->> 'sauce_extra_id')
              !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
    where
      (input_item.value ->> 'quantity')::pg_catalog.int4
        not between 1 and 99
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if exists (
    select 1
    from (
      select
        (input_item.value ->> 'menu_item_id')::pg_catalog.uuid
          as menu_item_id
      from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
      group by
        (input_item.value ->> 'menu_item_id')::pg_catalog.uuid
      having pg_catalog.count(*) > 1
    ) as duplicate_item
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'menu_item_id', pg_catalog.lower(input_item.value ->> 'menu_item_id'),
      'cheese_extra_id',
        case
          when pg_catalog.jsonb_typeof(
            input_item.value -> 'cheese_extra_id'
          ) = 'string'
          then pg_catalog.lower(input_item.value ->> 'cheese_extra_id')
          else null
        end,
      'vegetable_extra_id',
        case
          when pg_catalog.jsonb_typeof(
            input_item.value -> 'vegetable_extra_id'
          ) = 'string'
          then pg_catalog.lower(input_item.value ->> 'vegetable_extra_id')
          else null
        end,
      'sauce_extra_id',
        case
          when pg_catalog.jsonb_typeof(
            input_item.value -> 'sauce_extra_id'
          ) = 'string'
          then pg_catalog.lower(input_item.value ->> 'sauce_extra_id')
          else null
        end
    )
    order by pg_catalog.lower(input_item.value ->> 'menu_item_id')
  )
  into v_normalized_extra_payload
  from pg_catalog.jsonb_array_elements(p_items) as input_item(value);

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
    where
      pg_catalog.jsonb_typeof(input_item.value -> 'cheese_extra_id') = 'string'
      or pg_catalog.jsonb_typeof(
        input_item.value -> 'vegetable_extra_id'
      ) = 'string'
      or pg_catalog.jsonb_typeof(input_item.value -> 'sauce_extra_id') = 'string'
  ) then
    v_effective_request_fingerprint :=
      pg_catalog.encode(
        pg_catalog.sha256(
          pg_catalog.convert_to(
            'coffee-break-extras-v1|'
            || p_request_fingerprint
            || '|'
            || v_normalized_extra_payload::pg_catalog.text,
            'UTF8'
          )
        ),
        'hex'
      );
  else
    -- Mantiene compatibili i retry degli ordini storici senza extra.
    v_effective_request_fingerprint := p_request_fingerprint;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_idempotency_key::pg_catalog.text,
      0
    )
  );

  select
    existing_order.id,
    existing_order.order_number,
    existing_order.total,
    existing_order.request_fingerprint
  into
    v_existing_order_id,
    v_existing_order_number,
    v_existing_total,
    v_existing_fingerprint
  from public.orders as existing_order
  where existing_order.idempotency_key = p_idempotency_key;

  if v_existing_order_id is not null then
    if v_existing_fingerprint <> v_effective_request_fingerprint then
      raise exception using
        errcode = 'P0001',
        message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      v_existing_order_id,
      v_existing_order_number,
      v_existing_total;
    return;
  end if;

  if p_fulfillment_type is null
    or p_fulfillment_type not in ('delivery', 'pickup') then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_FULFILLMENT';
  end if;

  v_customer_name := pg_catalog.btrim(p_customer_name);
  v_customer_phone := pg_catalog.btrim(p_customer_phone);
  v_customer_email := nullif(pg_catalog.btrim(p_customer_email), '');
  v_customer_notes := nullif(pg_catalog.btrim(p_customer_notes), '');

  if v_customer_name is null
    or v_customer_name = ''
    or pg_catalog.char_length(v_customer_name) > 120
    or v_customer_phone is null
    or v_customer_phone = ''
    or pg_catalog.char_length(v_customer_phone) > 40
    or (
      v_customer_email is not null
      and (
        pg_catalog.char_length(v_customer_email) > 254
        or v_customer_email
          !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
    or (
      v_customer_notes is not null
      and pg_catalog.char_length(v_customer_notes) > 1000
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CUSTOMER_DATA';
  end if;

  if p_fulfillment_type = 'delivery' then
    v_delivery_point :=
      pg_catalog.upper(nullif(pg_catalog.btrim(p_delivery_point), ''));

    if v_delivery_point is null
      or v_delivery_point not in (
        'A',
        'B',
        'C',
        'PRONTO_SOCCORSO',
        'PALAZZINA_BLU'
      ) then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_CUSTOMER_DATA';
    end if;

    v_payment_method := 'on_delivery';
    v_effective_delivery_fee := v_delivery_fee;
  else
    v_delivery_point := null;
    v_payment_method := 'on_pickup';
    v_effective_delivery_fee := 0.00;
  end if;

  if p_requested_date is null
    or p_requested_date
      < (pg_catalog.now() at time zone 'Europe/Rome')::pg_catalog.date then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_REQUEST_DATE';
  end if;

  if p_fulfillment_type = 'delivery'
    and (
      p_requested_time is null
      or p_requested_time not in (
        time '12:00:00',
        time '12:15:00',
        time '12:30:00',
        time '12:45:00',
        time '13:00:00',
        time '13:15:00',
        time '13:30:00',
        time '13:45:00',
        time '14:00:00'
      )
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_REQUEST_TIME';
  end if;

  with parsed_items as materialized (
    select
      (input_item.value ->> 'menu_item_id')::pg_catalog.uuid
        as menu_item_id,
      (input_item.value ->> 'quantity')::pg_catalog.int4
        as quantity,
      nullif(
        pg_catalog.btrim(input_item.value ->> 'customer_notes'),
        ''
      ) as customer_notes,
      case
        when pg_catalog.jsonb_typeof(
          input_item.value -> 'cheese_extra_id'
        ) = 'string'
        then (input_item.value ->> 'cheese_extra_id')::pg_catalog.uuid
        else null
      end as cheese_extra_id,
      case
        when pg_catalog.jsonb_typeof(
          input_item.value -> 'vegetable_extra_id'
        ) = 'string'
        then (input_item.value ->> 'vegetable_extra_id')::pg_catalog.uuid
        else null
      end as vegetable_extra_id,
      case
        when pg_catalog.jsonb_typeof(
          input_item.value -> 'sauce_extra_id'
        ) = 'string'
        then (input_item.value ->> 'sauce_extra_id')::pg_catalog.uuid
        else null
      end as sauce_extra_id
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
  ),
  locked_menu_items as materialized (
    select
      menu_item.id,
      menu_item.name,
      menu_item.price,
      menu_item.customizable,
      case
        when pg_catalog.lower(pg_catalog.btrim(category.slug)) = 'panini'
          then 'PANINO'::pg_catalog.text
        when pg_catalog.lower(pg_catalog.btrim(category.slug)) = 'piadine'
          then 'PIADINA'::pg_catalog.text
        else null
      end as customization_scope
    from public.menu_items as menu_item
    join public.categories as category
      on category.id = menu_item.category_id
    join parsed_items as parsed_item
      on parsed_item.menu_item_id = menu_item.id
    where
      menu_item.available = true
      and menu_item.orderable = true
      and menu_item.price >= 0
      and pg_catalog.btrim(menu_item.name) <> ''
    for share of menu_item
  ),
  requested_extras as materialized (
    select
      parsed_item.menu_item_id,
      requested_extra.extra_id,
      requested_extra.group_code
    from parsed_items as parsed_item
    cross join lateral (
      values
        (
          parsed_item.cheese_extra_id,
          'FORMAGGIO'::pg_catalog.text
        ),
        (
          parsed_item.vegetable_extra_id,
          'VERDURA'::pg_catalog.text
        ),
        (
          parsed_item.sauce_extra_id,
          'SALSA'::pg_catalog.text
        )
    ) as requested_extra(extra_id, group_code)
    where requested_extra.extra_id is not null
  ),
  locked_extras as materialized (
    select
      requested_extra.menu_item_id,
      menu_item_extra.id,
      menu_item_extra.name,
      menu_item_extra.group_code,
      menu_item_extra.price
    from requested_extras as requested_extra
    join locked_menu_items as locked_menu_item
      on locked_menu_item.id = requested_extra.menu_item_id
    join public.menu_item_extras as menu_item_extra
      on menu_item_extra.id = requested_extra.extra_id
      and menu_item_extra.group_code = requested_extra.group_code
    where
      locked_menu_item.customizable = true
      and locked_menu_item.customization_scope is not null
      and menu_item_extra.available = true
      and menu_item_extra.applies_to in (
        locked_menu_item.customization_scope,
        'ENTRAMBI'
      )
    for share of menu_item_extra
  ),
  item_extra_totals as materialized (
    select
      parsed_item.menu_item_id,
      coalesce(
        pg_catalog.sum(locked_extra.price),
        0
      ) as extras_unit_price,
      coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'extra_id', locked_extra.id,
            'extra_name', locked_extra.name,
            'group_code', locked_extra.group_code,
            'extra_unit_price', locked_extra.price
          )
          order by locked_extra.group_code
        ) filter (where locked_extra.id is not null),
        '[]'::pg_catalog.jsonb
      ) as selected_extras
    from parsed_items as parsed_item
    left join locked_extras as locked_extra
      on locked_extra.menu_item_id = parsed_item.menu_item_id
    group by parsed_item.menu_item_id
  )
  select
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'menu_item_id', locked_item.id,
        'item_name', locked_item.name,
        'unit_price', locked_item.price,
        'extras_unit_price', extra_total.extras_unit_price,
        'quantity', parsed_item.quantity,
        'customer_notes', parsed_item.customer_notes,
        'selected_extras', extra_total.selected_extras,
        'line_total',
          (
            locked_item.price + extra_total.extras_unit_price
          ) * parsed_item.quantity
      )
      order by parsed_item.menu_item_id
    ),
    pg_catalog.count(*)::pg_catalog.int4,
    pg_catalog.sum(
      (
        locked_item.price + extra_total.extras_unit_price
      ) * parsed_item.quantity
    ),
    pg_catalog.max(
      (
        locked_item.price + extra_total.extras_unit_price
      ) * parsed_item.quantity
    ),
    (
      select pg_catalog.count(*)::pg_catalog.int4
      from requested_extras
    ),
    (
      select pg_catalog.count(*)::pg_catalog.int4
      from locked_extras
    )
  into
    v_validated_items,
    v_matched_item_count,
    v_subtotal,
    v_max_line_total,
    v_requested_extra_count,
    v_matched_extra_count
  from parsed_items as parsed_item
  join locked_menu_items as locked_item
    on locked_item.id = parsed_item.menu_item_id
  join item_extra_totals as extra_total
    on extra_total.menu_item_id = parsed_item.menu_item_id;

  if v_matched_item_count <> v_item_count then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_NOT_AVAILABLE';
  end if;

  if v_matched_extra_count <> v_requested_extra_count then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  if v_subtotal is null
    or v_subtotal <= 0
    or v_max_line_total > 99999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  v_total := v_subtotal + v_effective_delivery_fee;

  if v_subtotal > 99999999.99 or v_total > 99999999.99 then
    raise exception using
      errcode = 'P0001',
      message = 'ORDER_CREATION_FAILED';
  end if;

  insert into public.orders as new_order (
    fulfillment_type,
    status,
    customer_name,
    customer_phone,
    customer_email,
    delivery_point,
    requested_date,
    requested_time,
    customer_notes,
    subtotal,
    delivery_fee,
    total,
    payment_method,
    idempotency_key,
    request_fingerprint
  ) values (
    p_fulfillment_type,
    'new',
    v_customer_name,
    v_customer_phone,
    v_customer_email,
    v_delivery_point,
    p_requested_date,
    p_requested_time,
    v_customer_notes,
    v_subtotal,
    v_effective_delivery_fee,
    v_total,
    v_payment_method,
    p_idempotency_key,
    v_effective_request_fingerprint
  )
  returning new_order.id, new_order.order_number
  into v_order_id, v_order_number;

  with validated_items as materialized (
    select *
    from pg_catalog.jsonb_to_recordset(v_validated_items) as validated_item (
      menu_item_id pg_catalog.uuid,
      item_name pg_catalog.text,
      unit_price pg_catalog.numeric,
      extras_unit_price pg_catalog.numeric,
      quantity pg_catalog.int4,
      customer_notes pg_catalog.text,
      selected_extras pg_catalog.jsonb,
      line_total pg_catalog.numeric
    )
  ),
  inserted_order_items as (
    insert into public.order_items (
      order_id,
      menu_item_id,
      item_name,
      unit_price,
      extras_unit_price,
      quantity,
      line_total,
      customer_notes
    )
    select
      v_order_id,
      validated_item.menu_item_id,
      validated_item.item_name,
      validated_item.unit_price,
      validated_item.extras_unit_price,
      validated_item.quantity,
      validated_item.line_total,
      validated_item.customer_notes
    from validated_items as validated_item
    returning id, menu_item_id
  ),
  inserted_order_item_extras as (
    insert into public.order_item_extras (
      order_item_id,
      extra_id,
      extra_name,
      group_code,
      extra_unit_price
    )
    select
      inserted_item.id,
      selected_extra.extra_id,
      selected_extra.extra_name,
      selected_extra.group_code,
      selected_extra.extra_unit_price
    from validated_items as validated_item
    join inserted_order_items as inserted_item
      on inserted_item.menu_item_id = validated_item.menu_item_id
    cross join lateral pg_catalog.jsonb_to_recordset(
      validated_item.selected_extras
    ) as selected_extra (
      extra_id pg_catalog.uuid,
      extra_name pg_catalog.text,
      group_code pg_catalog.text,
      extra_unit_price pg_catalog.numeric
    )
    returning id
  )
  select
    (
      select pg_catalog.count(*)::pg_catalog.int4
      from inserted_order_items
    ),
    (
      select pg_catalog.count(*)::pg_catalog.int4
      from inserted_order_item_extras
    )
  into
    v_inserted_item_count,
    v_inserted_extra_count;

  if v_inserted_item_count <> v_item_count
    or v_inserted_extra_count <> v_requested_extra_count then
    raise exception using
      errcode = 'P0001',
      message = 'ORDER_CREATION_FAILED';
  end if;

  return query
  select
    v_order_id,
    v_order_number,
    v_total::pg_catalog.numeric(10, 2);
exception
  when numeric_value_out_of_range then
    raise exception using
      errcode = 'P0001',
      message = 'ORDER_CREATION_FAILED';
end;
$function$;

alter function public.create_public_order(
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.date,
  pg_catalog.jsonb,
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.time,
  pg_catalog.text
)
owner to postgres;

revoke all privileges
  on function public.create_public_order(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.date,
    pg_catalog.jsonb,
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.time,
    pg_catalog.text
  )
  from public, anon, authenticated;

grant execute
  on function public.create_public_order(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.date,
    pg_catalog.jsonb,
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.time,
    pg_catalog.text
  )
  to service_role;

comment on function public.create_public_order(
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.date,
  pg_catalog.jsonb,
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.time,
  pg_catalog.text
)
is 'Crea atomicamente un ordine idempotente con prezzi base ed extra calcolati server-side, usando soltanto piatti disponibili e ordinabili e mantenendo consegna ospedaliera gratuita nei punti e negli orari consentiti.';

commit;
