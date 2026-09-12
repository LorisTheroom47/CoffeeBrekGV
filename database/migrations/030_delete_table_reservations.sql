-- Coffee Break GV
-- Cancellazione controllata delle prenotazioni tavoli riservata agli Admin.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

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
  if (select private.is_admin()) is not true then
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

comment on function public.delete_table_reservation(pg_catalog.uuid)
is 'Elimina una singola prenotazione tavolo soltanto per un Admin autorizzato.';

commit;
