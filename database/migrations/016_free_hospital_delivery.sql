-- Coffee Break GV
-- Consegna ospedaliera temporaneamente gratuita.
-- La struttura della tariffa resta invariata per consentirne la futura riattivazione.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

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
  v_inserted_item_count pg_catalog.int4;
  v_validated_items pg_catalog.jsonb;
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
  -- p_request_fingerprint è prodotto dal backend fidato. Questo controllo non
  -- sostituisce il calcolo dell'hash: impedisce soltanto valori malformati.
  if p_idempotency_key is null
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_ITEMS';
  end if;

  -- Il lock transazionale serializza anche due richieste contemporanee con la
  -- stessa chiave. Una collisione dell'hash del lock può solo serializzare
  -- chiavi diverse: l'unicità e i confronti usano sempre l'UUID completo.
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
    if v_existing_fingerprint <> p_request_fingerprint then
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
      or v_delivery_point not in ('A', 'B', 'C') then
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
      'customer_notes'
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

  with parsed_items as materialized (
    select
      (input_item.value ->> 'menu_item_id')::pg_catalog.uuid
        as menu_item_id,
      (input_item.value ->> 'quantity')::pg_catalog.int4
        as quantity,
      nullif(
        pg_catalog.btrim(input_item.value ->> 'customer_notes'),
        ''
      ) as customer_notes
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
  ),
  locked_menu_items as materialized (
    select
      menu_item.id,
      menu_item.name,
      menu_item.price
    from public.menu_items as menu_item
    join parsed_items as parsed_item
      on parsed_item.menu_item_id = menu_item.id
    where
      menu_item.available = true
      and menu_item.price >= 0
      and pg_catalog.btrim(menu_item.name) <> ''
    for share of menu_item
  )
  select
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'menu_item_id', locked_item.id,
        'item_name', locked_item.name,
        'unit_price', locked_item.price,
        'quantity', parsed_item.quantity,
        'customer_notes', parsed_item.customer_notes,
        'line_total', locked_item.price * parsed_item.quantity
      )
      order by parsed_item.menu_item_id
    ),
    pg_catalog.count(*)::pg_catalog.int4,
    pg_catalog.sum(locked_item.price * parsed_item.quantity),
    pg_catalog.max(locked_item.price * parsed_item.quantity)
  into
    v_validated_items,
    v_matched_item_count,
    v_subtotal,
    v_max_line_total
  from parsed_items as parsed_item
  join locked_menu_items as locked_item
    on locked_item.id = parsed_item.menu_item_id;

  if v_matched_item_count <> v_item_count then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_NOT_AVAILABLE';
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
    p_request_fingerprint
  )
  returning new_order.id, new_order.order_number
  into v_order_id, v_order_number;

  insert into public.order_items (
    order_id,
    menu_item_id,
    item_name,
    unit_price,
    quantity,
    line_total,
    customer_notes
  )
  select
    v_order_id,
    validated_item.menu_item_id,
    validated_item.item_name,
    validated_item.unit_price,
    validated_item.quantity,
    validated_item.line_total,
    validated_item.customer_notes
  from pg_catalog.jsonb_to_recordset(v_validated_items) as validated_item (
    menu_item_id pg_catalog.uuid,
    item_name pg_catalog.text,
    unit_price pg_catalog.numeric,
    quantity pg_catalog.int4,
    customer_notes pg_catalog.text,
    line_total pg_catalog.numeric
  );

  get diagnostics v_inserted_item_count = row_count;

  if v_inserted_item_count <> v_item_count then
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
is 'Crea atomicamente un ordine idempotente con ritiro o consegna ospedaliera temporaneamente gratuita nei punti A, B o C, usando prezzi e disponibilità correnti.';



commit;

