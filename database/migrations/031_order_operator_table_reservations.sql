-- Coffee Break GV
-- Gestione controllata delle prenotazioni per Admin e order_operator.

begin;

create or replace function private.can_manage_reservations()
returns pg_catalog.bool
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select private.is_admin())
    or (select private.is_order_operator());
$function$;

alter function private.can_manage_reservations()
owner to postgres;

revoke all privileges
  on function private.can_manage_reservations()
  from public, anon, authenticated;

grant execute
  on function private.can_manage_reservations()
  to authenticated;

drop policy if exists table_reservations_select_admin
  on public.table_reservations;

drop policy if exists table_reservations_select_managers
  on public.table_reservations;

create policy table_reservations_select_managers
on public.table_reservations
for select
to authenticated
using ((select private.can_manage_reservations()));

create or replace function public.delete_table_reservation(
  p_reservation_id pg_catalog.uuid
)
returns pg_catalog.text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_deleted_reservation_id pg_catalog.uuid;
begin
  if (select private.can_manage_reservations()) is not true then
    return 'access_denied';
  end if;

  if p_reservation_id is null then
    return 'invalid_id';
  end if;

  delete from public.table_reservations as target_reservation
  where target_reservation.id = p_reservation_id
  returning target_reservation.id into v_deleted_reservation_id;

  if v_deleted_reservation_id is null then
    return 'not_found';
  end if;

  return 'deleted';
end;
$function$;

alter function public.delete_table_reservation(pg_catalog.uuid)
owner to postgres;

revoke all privileges
  on function public.delete_table_reservation(pg_catalog.uuid)
  from public, anon, authenticated;

grant execute
  on function public.delete_table_reservation(pg_catalog.uuid)
  to authenticated;

create or replace function public.update_table_reservation(
  p_reservation_id pg_catalog.uuid,
  p_customer_name pg_catalog.text,
  p_customer_phone pg_catalog.text,
  p_party_size pg_catalog.int4,
  p_reservation_date pg_catalog.date,
  p_reservation_time pg_catalog.time,
  p_customer_notes pg_catalog.text
)
returns pg_catalog.text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_customer_name pg_catalog.text;
  v_customer_phone pg_catalog.text;
  v_customer_notes pg_catalog.text;
  v_today pg_catalog.date :=
    (pg_catalog.now() at time zone 'Europe/Rome')::pg_catalog.date;
  v_current_time pg_catalog.time :=
    (pg_catalog.now() at time zone 'Europe/Rome')::pg_catalog.time;
  v_existing_reservation_date pg_catalog.date;
  v_existing_reservation_time pg_catalog.time;
begin
  if (select private.can_manage_reservations()) is not true then
    return 'access_denied';
  end if;

  if p_reservation_id is null then
    return 'invalid_id';
  end if;

  select
    target_reservation.reservation_date,
    target_reservation.reservation_time
  into
    v_existing_reservation_date,
    v_existing_reservation_time
  from public.table_reservations as target_reservation
  where target_reservation.id = p_reservation_id
  for update;

  if not found then
    return 'not_found';
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
    )
    or p_reservation_date is null
    or p_reservation_time is null
    or p_reservation_time not in (
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
    or (
      (
        p_reservation_date is distinct from v_existing_reservation_date
        or p_reservation_time is distinct from v_existing_reservation_time
      )
      and (
        p_reservation_date < v_today
        or (
          p_reservation_date = v_today
          and p_reservation_time <= v_current_time
        )
      )
    ) then
    return 'invalid_data';
  end if;

  update public.table_reservations as target_reservation
  set
    customer_name = v_customer_name,
    customer_phone = v_customer_phone,
    party_size = p_party_size,
    reservation_date = p_reservation_date,
    reservation_time = p_reservation_time,
    customer_notes = v_customer_notes
  where target_reservation.id = p_reservation_id;

  return 'updated';
end;
$function$;

alter function public.update_table_reservation(
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.int4,
  pg_catalog.date,
  pg_catalog.time,
  pg_catalog.text
)
owner to postgres;

revoke all privileges
  on function public.update_table_reservation(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.date,
    pg_catalog.time,
    pg_catalog.text
  )
  from public, anon, authenticated;

grant execute
  on function public.update_table_reservation(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.int4,
    pg_catalog.date,
    pg_catalog.time,
    pg_catalog.text
  )
  to authenticated;

comment on function private.can_manage_reservations()
is 'Autorizza la gestione prenotazioni agli Admin e agli order_operator.';

comment on function public.delete_table_reservation(pg_catalog.uuid)
is 'Elimina una singola prenotazione per un gestore prenotazioni autorizzato.';

comment on function public.update_table_reservation(
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text,
  pg_catalog.int4,
  pg_catalog.date,
  pg_catalog.time,
  pg_catalog.text
)
is 'Aggiorna esclusivamente i dati operativi di una singola prenotazione.';

commit;
