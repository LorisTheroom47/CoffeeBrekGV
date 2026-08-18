-- Coffee Break Monza
-- Controlli di sola lettura dopo la rimozione di public.orders da Postgres Changes.
-- Non invia Broadcast e non modifica dati, publication, trigger, funzioni o policy.

-- Attesa: publication_count = 1.
select pg_catalog.count(*) as publication_count
from pg_catalog.pg_publication as publication
where publication.pubname = 'supabase_realtime';

-- Attesa: orders_postgres_changes_count = 0.
select pg_catalog.count(*) as orders_postgres_changes_count
from pg_catalog.pg_publication_tables as publication_table
where publication_table.pubname = 'supabase_realtime'
  and publication_table.schemaname = 'public'
  and publication_table.tablename = 'orders';

-- Attese: function_count = 1, expected_topic = true ed expected_event = true.
select
  pg_catalog.count(*) as function_count,
  coalesce(
    pg_catalog.bool_and(routine.prosrc ilike '%''admin:orders''%'),
    false
  ) as expected_topic,
  coalesce(
    pg_catalog.bool_and(routine.prosrc ilike '%''new_order''%'),
    false
  ) as expected_event,
  coalesce(
    pg_catalog.bool_and(routine.prosrc ilike '%realtime.send(%'),
    false
  ) as uses_realtime_send
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'private'
  and routine.proname = 'broadcast_new_order'
  and routine.prokind = 'f'
  and routine.pronargs = 0
  and routine.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype;

-- Attesa: trigger_count = 1. Il trigger resta AFTER INSERT, FOR EACH ROW e
-- collegato esclusivamente a private.broadcast_new_order().
select pg_catalog.count(*) as trigger_count
from pg_catalog.pg_trigger as trigger_name
join pg_catalog.pg_class as protected_table
  on protected_table.oid = trigger_name.tgrelid
join pg_catalog.pg_namespace as table_schema
  on table_schema.oid = protected_table.relnamespace
join pg_catalog.pg_proc as trigger_function
  on trigger_function.oid = trigger_name.tgfoid
join pg_catalog.pg_namespace as function_schema
  on function_schema.oid = trigger_function.pronamespace
where not trigger_name.tgisinternal
  and trigger_name.tgname = 'orders_broadcast_new_order'
  and table_schema.nspname = 'public'
  and protected_table.relname = 'orders'
  and function_schema.nspname = 'private'
  and trigger_function.proname = 'broadcast_new_order'
  and (trigger_name.tgtype & 1) = 1
  and (trigger_name.tgtype & 2) = 0
  and (trigger_name.tgtype & 4) = 4
  and (trigger_name.tgtype & 8) = 0
  and (trigger_name.tgtype & 16) = 0
  and (trigger_name.tgtype & 32) = 0;

-- Attese: policy_count = 1 e tutti i flag = true.
select
  pg_catalog.count(*) as policy_count,
  coalesce(pg_catalog.bool_and(policy.cmd = 'SELECT'), false)
    as select_only,
  coalesce(
    pg_catalog.bool_and(
      policy.roles = array['authenticated']::pg_catalog.name[]
    ),
    false
  ) as authenticated_only,
  coalesce(
    pg_catalog.bool_and(policy.qual ilike '%extension%broadcast%'),
    false
  ) as broadcast_only,
  coalesce(
    pg_catalog.bool_and(policy.qual ilike '%admin:orders%'),
    false
  ) as expected_topic_only,
  coalesce(
    pg_catalog.bool_and(policy.qual ilike '%private.is_admin()%'),
    false
  ) as uses_admin_helper
from pg_catalog.pg_policies as policy
where policy.schemaname = 'realtime'
  and policy.tablename = 'messages'
  and policy.policyname = 'orders_broadcast_receive_admin';

-- Attese: realtime_messages_rls_enabled = true e orders_rls_enabled = true.
select
  pg_catalog.count(*) filter (
    where schema_name.nspname = 'realtime'
      and protected_table.relname = 'messages'
      and protected_table.relrowsecurity
  ) = 1 as realtime_messages_rls_enabled,
  pg_catalog.count(*) filter (
    where schema_name.nspname = 'public'
      and protected_table.relname = 'orders'
      and protected_table.relrowsecurity
  ) = 1 as orders_rls_enabled
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where (schema_name.nspname = 'realtime' and protected_table.relname = 'messages')
   or (schema_name.nspname = 'public' and protected_table.relname = 'orders');

-- Attesa: helper_count = 1.
select pg_catalog.count(*) as helper_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where schema_name.nspname = 'private'
  and routine.proname = 'is_admin'
  and routine.prokind = 'f'
  and routine.pronargs = 0;

-- Attese: tutti i conteggi = 1. Le policy di public.orders restano presenti
-- e la migrazione 012 non ne modifica definizione, ruoli o condizioni.
select
  pg_catalog.count(*) filter (
    where policy.policyname = 'orders_select_admin'
      and policy.cmd = 'SELECT'
  ) as select_policy_count,
  pg_catalog.count(*) filter (
    where policy.policyname = 'orders_insert_admin'
      and policy.cmd = 'INSERT'
  ) as insert_policy_count,
  pg_catalog.count(*) filter (
    where policy.policyname = 'orders_update_admin'
      and policy.cmd = 'UPDATE'
  ) as update_policy_count,
  pg_catalog.count(*) filter (
    where policy.policyname = 'orders_delete_admin'
      and policy.cmd = 'DELETE'
  ) as delete_policy_count
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'orders';

-- Dettaglio di sola lettura per revisionare ruoli e condizioni delle quattro
-- policy senza alterarle.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies as policy
where policy.schemaname = 'public'
  and policy.tablename = 'orders'
  and policy.policyname in (
    'orders_select_admin',
    'orders_insert_admin',
    'orders_update_admin',
    'orders_delete_admin'
  )
order by policy.policyname;
