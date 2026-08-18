-- Coffee Break Monza
-- Broadcast privato e minimale per i nuovi ordini amministrativi.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

-- SECURITY DEFINER è necessario perché il trigger deve invocare la primitiva
-- database di Realtime senza concedere privilegi di invio ai client.
create or replace function private.broadcast_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform realtime.send(
    pg_catalog.jsonb_build_object(
      'order_id', new.id::pg_catalog.text,
      'order_number', new.order_number::pg_catalog.text,
      'fulfillment_type', new.fulfillment_type,
      'total', new.total::pg_catalog.text,
      'status', new.status,
      'created_at', new.created_at
    ),
    'new_order',
    'admin:orders',
    true
  );

  return new;
end;
$function$;

alter function private.broadcast_new_order()
owner to postgres;

revoke all privileges
  on function private.broadcast_new_order()
  from public, anon, authenticated;

comment on function private.broadcast_new_order()
is 'Invia un Broadcast privato e privo di PII dopo un INSERT in public.orders.';

drop trigger if exists orders_broadcast_new_order
  on public.orders;

create trigger orders_broadcast_new_order
after insert on public.orders
for each row
execute function private.broadcast_new_order();

-- Realtime Authorization valuta questa policy quando un client autenticato
-- tenta di entrare nel canale privato. Non è necessaria una policy INSERT per
-- i client: l'invio avviene esclusivamente dal trigger database.
drop policy if exists orders_broadcast_receive_admin
  on realtime.messages;

create policy orders_broadcast_receive_admin
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'admin:orders'
  and (select private.is_admin())
);

commit;
