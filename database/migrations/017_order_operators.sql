-- Coffee Break GV
-- Accesso ristoratore limitato alla gestione degli ordini.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

create table if not exists public.order_operators (
  user_id pg_catalog.uuid not null primary key,
  created_at pg_catalog.timestamptz not null default pg_catalog.now(),
  constraint order_operators_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on update cascade
    on delete cascade
);

alter table public.order_operators enable row level security;
alter table public.order_operators force row level security;

revoke all privileges
  on table public.order_operators
  from public, anon, authenticated;

grant select
  on table public.order_operators
  to authenticated;

drop policy if exists order_operators_select_own
  on public.order_operators;

create policy order_operators_select_own
on public.order_operators
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function private.is_order_operator()
returns pg_catalog.bool
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.order_operators as order_operator
    where order_operator.user_id = (select auth.uid())
  );
$function$;

alter function private.is_order_operator()
owner to postgres;

revoke all privileges
  on function private.is_order_operator()
  from public, anon, authenticated;

grant execute
  on function private.is_order_operator()
  to authenticated;

comment on function private.is_order_operator()
is 'Restituisce true soltanto quando auth.uid() appartiene a public.order_operators.';

create or replace function private.can_manage_orders()
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

alter function private.can_manage_orders()
owner to postgres;

revoke all privileges
  on function private.can_manage_orders()
  from public, anon, authenticated;

grant execute
  on function private.can_manage_orders()
  to authenticated;

comment on function private.can_manage_orders()
is 'Autorizza la gestione ordini agli amministratori o agli operatori ordini.';

drop policy if exists orders_select_admin
  on public.orders;

create policy orders_select_admin
on public.orders
for select
to authenticated
using ((select private.can_manage_orders()));

drop policy if exists order_items_select_admin
  on public.order_items;

create policy order_items_select_admin
on public.order_items
for select
to authenticated
using ((select private.can_manage_orders()));

create or replace function public.update_order_status(
  p_order_id pg_catalog.uuid,
  p_expected_status pg_catalog.text,
  p_target_status pg_catalog.text
)
returns pg_catalog.text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_current_status pg_catalog.text;
  v_fulfillment_type pg_catalog.text;
  v_transition_allowed pg_catalog.bool := false;
begin
  if not (select private.can_manage_orders()) then
    raise insufficient_privilege using message = 'ORDER_ACCESS_DENIED';
  end if;

  if
    p_order_id is null
    or p_expected_status is null
    or p_target_status is null
    or p_expected_status not in (
      'new',
      'confirmed',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
      'cancelled'
    )
    or p_target_status not in (
      'confirmed',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
      'cancelled'
    )
  then
    return 'invalid_transition';
  end if;

  select
    orders.status,
    orders.fulfillment_type
  into
    v_current_status,
    v_fulfillment_type
  from public.orders
  where orders.id = p_order_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_current_status <> p_expected_status then
    return 'conflict';
  end if;

  v_transition_allowed := case
    when v_current_status = 'new' then
      p_target_status in ('confirmed', 'cancelled')
    when v_current_status = 'confirmed' then
      p_target_status in ('preparing', 'cancelled')
    when v_current_status = 'preparing' then
      p_target_status in ('ready', 'cancelled')
    when v_current_status = 'ready' and v_fulfillment_type = 'pickup' then
      p_target_status in ('completed', 'cancelled')
    when v_current_status = 'ready' and v_fulfillment_type = 'delivery' then
      p_target_status in ('out_for_delivery', 'cancelled')
    when
      v_current_status = 'out_for_delivery'
      and v_fulfillment_type = 'delivery'
    then
      p_target_status in ('completed', 'cancelled')
    else false
  end;

  if not v_transition_allowed then
    return 'invalid_transition';
  end if;

  update public.orders
  set status = p_target_status
  where
    orders.id = p_order_id
    and orders.status = p_expected_status;

  if not found then
    return 'conflict';
  end if;

  return 'updated';
end;
$function$;

alter function public.update_order_status(
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text
)
owner to postgres;

revoke all privileges
  on function public.update_order_status(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text
  )
  from public, anon, authenticated;

grant execute
  on function public.update_order_status(
    pg_catalog.uuid,
    pg_catalog.text,
    pg_catalog.text
  )
  to authenticated;

comment on function public.update_order_status(
  pg_catalog.uuid,
  pg_catalog.text,
  pg_catalog.text
)
is 'Aggiorna esclusivamente lo stato di un ordine con controllo ruolo, transizione e concorrenza.';

drop policy if exists orders_broadcast_receive_admin
  on realtime.messages;

create policy orders_broadcast_receive_admin
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'admin:orders'
  and (select private.can_manage_orders())
);

commit;
