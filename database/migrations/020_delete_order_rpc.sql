-- Coffee Break GV
-- Cancellazione controllata di un ordine per admin e operatori ordini.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

create or replace function public.delete_order(
  p_order_id pg_catalog.uuid
)
returns pg_catalog.text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_deleted_order_id pg_catalog.uuid;
begin
  if not (select private.can_manage_orders()) then
    return 'access_denied';
  end if;

  if p_order_id is null then
    return 'not_found';
  end if;

  delete from public.orders as target_order
  where target_order.id = p_order_id
  returning target_order.id into v_deleted_order_id;

  if v_deleted_order_id is null then
    return 'not_found';
  end if;

  return 'deleted';
end;
$function$;

alter function public.delete_order(pg_catalog.uuid)
owner to postgres;

revoke all privileges
  on function public.delete_order(pg_catalog.uuid)
  from public, anon, authenticated;

grant execute
  on function public.delete_order(pg_catalog.uuid)
  to authenticated;

comment on function public.delete_order(pg_catalog.uuid)
is 'Elimina un singolo ordine soltanto per admin o operatori ordini autorizzati.';

commit;
