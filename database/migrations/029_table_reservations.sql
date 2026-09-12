-- Coffee Break GV
-- Prima versione delle prenotazioni tavoli, separata dagli ordini pranzo.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

create table public.table_reservations (
  id pg_catalog.uuid not null primary key default gen_random_uuid(),
  reservation_number pg_catalog.int8 generated always as identity,
  customer_name pg_catalog.text not null,
  customer_phone pg_catalog.text not null,
  party_size pg_catalog.int2 not null,
  reservation_date pg_catalog.date not null,
  reservation_time pg_catalog.time(0) not null,
  customer_notes pg_catalog.text null,
  status pg_catalog.text not null default 'confirmed',
  idempotency_key pg_catalog.uuid not null,
  request_fingerprint pg_catalog.text not null,
  created_at pg_catalog.timestamptz not null default pg_catalog.now(),
  constraint table_reservations_reservation_number_key
    unique (reservation_number),
  constraint table_reservations_idempotency_key_key
    unique (idempotency_key),
  constraint table_reservations_customer_name_valid
    check (
      pg_catalog.btrim(customer_name) <> ''
      and pg_catalog.char_length(customer_name) <= 120
    ),
  constraint table_reservations_customer_phone_valid
    check (
      pg_catalog.btrim(customer_phone) <> ''
      and pg_catalog.char_length(customer_phone) <= 40
    ),
  constraint table_reservations_party_size_valid
    check (party_size between 1 and 8),
  constraint table_reservations_time_slot_valid
    check (
      reservation_time between '12:00:00'::pg_catalog.time
        and '14:00:00'::pg_catalog.time
      and extract(minute from reservation_time)::pg_catalog.int4 % 15 = 0
      and extract(second from reservation_time) = 0
    ),
  constraint table_reservations_notes_valid
    check (
      customer_notes is null
      or pg_catalog.char_length(customer_notes) <= 1000
    ),
  constraint table_reservations_status_confirmed
    check (status = 'confirmed'),
  constraint table_reservations_fingerprint_valid
    check (request_fingerprint ~ '^[0-9a-f]{64}$')
);

create index table_reservations_schedule_idx
  on public.table_reservations (
    reservation_date,
    reservation_time,
    created_at
  );

alter table public.table_reservations enable row level security;
alter table public.table_reservations force row level security;

revoke all privileges
  on table public.table_reservations
  from public, anon, authenticated;

revoke all privileges
  on sequence public.table_reservations_reservation_number_seq
  from public, anon, authenticated;

grant select
  on table public.table_reservations
  to authenticated;

create policy table_reservations_select_admin
on public.table_reservations
for select
to authenticated
using ((select private.is_admin()));

create function public.create_public_table_reservation(
  p_customer_name pg_catalog.text,
  p_customer_phone pg_catalog.text,
  p_party_size pg_catalog.int4,
  p_reservation_date pg_catalog.date,
  p_reservation_time pg_catalog.time,
  p_idempotency_key pg_catalog.uuid,
  p_request_fingerprint pg_catalog.text,
  p_customer_notes pg_catalog.text default null
)
returns table (
  reservation_id pg_catalog.uuid,
  reservation_number pg_catalog.int8,
  reservation_status pg_catalog.text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_customer_name pg_catalog.text;
  v_customer_phone pg_catalog.text;
  v_customer_notes pg_catalog.text;
  v_existing_id pg_catalog.uuid;
  v_existing_number pg_catalog.int8;
  v_existing_status pg_catalog.text;
  v_existing_fingerprint pg_catalog.text;
  v_reservation_id pg_catalog.uuid;
  v_reservation_number pg_catalog.int8;
begin
  if p_idempotency_key is null
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::pg_catalog.text, 0)
  );

  select
    existing_reservation.id,
    existing_reservation.reservation_number,
    existing_reservation.status,
    existing_reservation.request_fingerprint
  into
    v_existing_id,
    v_existing_number,
    v_existing_status,
    v_existing_fingerprint
  from public.table_reservations as existing_reservation
  where existing_reservation.idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    if v_existing_fingerprint <> p_request_fingerprint then
      raise exception using
        errcode = 'P0001',
        message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select v_existing_id, v_existing_number, v_existing_status;
    return;
  end if;

  v_customer_name := pg_catalog.btrim(p_customer_name);
  v_customer_phone := pg_catalog.btrim(p_customer_phone);
  v_customer_notes := nullif(pg_catalog.btrim(p_customer_notes), '');

  if v_customer_name is null
    or v_customer_name = ''
    or pg_catalog.char_length(v_customer_name) > 120
    or v_customer_phone is null
    or v_customer_phone = ''
    or pg_catalog.char_length(v_customer_phone) > 40
    or p_party_size is null
    or p_party_size not between 1 and 8
    or (
      v_customer_notes is not null
      and pg_catalog.char_length(v_customer_notes) > 1000
    ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CUSTOMER_DATA';
  end if;

  if p_reservation_date is null
    or p_reservation_date
      < (pg_catalog.now() at time zone 'Europe/Rome')::pg_catalog.date then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_RESERVATION_DATE';
  end if;

  if p_reservation_time is null
    or p_reservation_time < '12:00:00'::pg_catalog.time
    or p_reservation_time > '14:00:00'::pg_catalog.time
    or extract(minute from p_reservation_time)::pg_catalog.int4 % 15 <> 0
    or extract(second from p_reservation_time) <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_RESERVATION_TIME';
  end if;

  if p_reservation_date
      = (pg_catalog.now() at time zone 'Europe/Rome')::pg_catalog.date
    and p_reservation_time
      <= (pg_catalog.now() at time zone 'Europe/Rome')::pg_catalog.time then
    raise exception using
      errcode = 'P0001',
      message = 'RESERVATION_TIME_PASSED';
  end if;

  insert into public.table_reservations as new_reservation (
    customer_name,
    customer_phone,
    party_size,
    reservation_date,
    reservation_time,
    customer_notes,
    status,
    idempotency_key,
    request_fingerprint
  ) values (
    v_customer_name,
    v_customer_phone,
    p_party_size,
    p_reservation_date,
    p_reservation_time,
    v_customer_notes,
    'confirmed',
    p_idempotency_key,
    p_request_fingerprint
  )
  returning new_reservation.id, new_reservation.reservation_number
  into v_reservation_id, v_reservation_number;

  return query
  select v_reservation_id, v_reservation_number, 'confirmed'::pg_catalog.text;
end;
$function$;

alter function public.create_public_table_reservation(
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.int4,
  pg_catalog.date,
  pg_catalog.time,
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text
)
owner to postgres;

revoke all privileges
  on function public.create_public_table_reservation(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.date,
    pg_catalog.time,
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text
  )
  from public, anon, authenticated;

grant execute
  on function public.create_public_table_reservation(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.date,
    pg_catalog.time,
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text
  )
  to service_role;

comment on table public.table_reservations
is 'Prenotazioni tavoli confermate automaticamente, separate dagli ordini pranzo.';

comment on function public.create_public_table_reservation(
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.int4,
  pg_catalog.date,
  pg_catalog.time,
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text
)
is 'Crea una prenotazione tavolo idempotente tramite il solo backend fidato.';

commit;
