-- Coffee Break Monza
-- Controlli di sola lettura per Broadcast privato dei nuovi ordini.
-- Non invia Broadcast e non modifica dati, trigger, policy o publication.

-- Attese: una funzione trigger PL/pgSQL, owner postgres, SECURITY DEFINER,
-- nessun parametro e search_path vuoto.
select
  routine.oid::pg_catalog.regprocedure as function_signature,
  pg_catalog.pg_get_userbyid(routine.proowner) as function_owner,
  language.lanname as language_name,
  routine.prosecdef as security_definer,
  routine.pronargs as argument_count,
  pg_catalog.pg_get_function_result(routine.oid) as result_type,
  routine.proconfig as function_configuration,
  coalesce(
    pg_catalog.array_to_string(routine.proconfig, ','),
    ''
  ) = 'search_path=""' as search_path_is_empty
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
join pg_catalog.pg_language as language
  on language.oid = routine.prolang
where
  schema_name.nspname = 'private'
  and routine.proname = 'broadcast_new_order'
  and routine.prokind = 'f';

-- Attesa: function_count = 1.
select pg_catalog.count(*) as function_count
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where
  schema_name.nspname = 'private'
  and routine.proname = 'broadcast_new_order'
  and routine.prokind = 'f'
  and routine.pronargs = 0
  and routine.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype;

-- Attese: tutti true. Il payload è costruito esplicitamente, il topic è
-- costante, il messaggio è privato e nessuna PII o riga completa è inclusa.
with function_definition as (
  select
    routine.prosrc as source_code,
    pg_catalog.pg_get_functiondef(routine.oid) as definition
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'private'
    and routine.proname = 'broadcast_new_order'
    and routine.prokind = 'f'
    and routine.pronargs = 0
)
select
  source_code ilike '%realtime.send(%' as uses_realtime_send,
  source_code ilike '%pg_catalog.jsonb_build_object(%'
    as payload_is_explicit,
  source_code ilike '%''order_id''%' as includes_order_id,
  source_code ilike '%''order_number''%' as includes_order_number,
  source_code ilike '%''fulfillment_type''%' as includes_fulfillment_type,
  source_code ilike '%''total''%' as includes_total,
  source_code ilike '%''status''%' as includes_status,
  source_code ilike '%''created_at''%' as includes_created_at,
  source_code ilike '%''new_order''%' as uses_expected_event,
  source_code ilike '%''admin:orders''%' as uses_expected_topic,
  source_code ~* 'admin:orders''[[:space:]]*,[[:space:]]*true'
    as private_broadcast,
  source_code !~* 'customer_(name|phone|email|notes)'
    as no_customer_pii,
  source_code !~* 'delivery_(address|city|postal_code)'
    as no_delivery_pii,
  source_code not ilike '%admin_notes%' as no_admin_notes,
  source_code !~* '(row_to_json|to_json|to_jsonb)[[:space:]]*\([[:space:]]*new'
    as no_complete_new_serialization,
  source_code !~* '\mexecute\M' as no_dynamic_execute,
  source_code not ilike '%format(%' as no_dynamic_format,
  source_code not ilike '%||%' as no_query_concatenation,
  definition not ilike '%service_role%' as no_service_role
from function_definition;

-- Attese: PUBLIC, anon e authenticated non possono invocare direttamente la
-- funzione trigger. L'owner postgres la esegue tramite il trigger.
with target_function as (
  select routine.oid
  from pg_catalog.pg_proc as routine
  join pg_catalog.pg_namespace as schema_name
    on schema_name.oid = routine.pronamespace
  where
    schema_name.nspname = 'private'
    and routine.proname = 'broadcast_new_order'
    and routine.prokind = 'f'
    and routine.pronargs = 0
)
select
  not exists (
    select 1
    from information_schema.routine_privileges as privilege
    where
      privilege.specific_schema = 'private'
      and privilege.routine_name = 'broadcast_new_order'
      and privilege.grantee = 'PUBLIC'
      and privilege.privilege_type = 'EXECUTE'
  ) as public_execute_revoked,
  not pg_catalog.has_function_privilege(
    'anon', target_function.oid, 'EXECUTE'
  ) as anon_execute_revoked,
  not pg_catalog.has_function_privilege(
    'authenticated', target_function.oid, 'EXECUTE'
  ) as authenticated_execute_revoked
from target_function;

-- Attese: un trigger di riga, AFTER INSERT soltanto, su public.orders e
-- collegato alla funzione privata prevista.
select
  trigger_name.tgname as trigger_name,
  table_schema.nspname as table_schema,
  protected_table.relname as table_name,
  function_schema.nspname as function_schema,
  trigger_function.proname as function_name,
  (trigger_name.tgtype & 1) = 1 as is_row_trigger,
  (trigger_name.tgtype & 2) = 0 as is_after,
  (trigger_name.tgtype & 4) = 4 as fires_on_insert,
  (trigger_name.tgtype & 8) = 0 as not_delete,
  (trigger_name.tgtype & 16) = 0 as not_update,
  (trigger_name.tgtype & 32) = 0 as not_truncate,
  pg_catalog.pg_get_triggerdef(trigger_name.oid) as trigger_definition
from pg_catalog.pg_trigger as trigger_name
join pg_catalog.pg_class as protected_table
  on protected_table.oid = trigger_name.tgrelid
join pg_catalog.pg_namespace as table_schema
  on table_schema.oid = protected_table.relnamespace
join pg_catalog.pg_proc as trigger_function
  on trigger_function.oid = trigger_name.tgfoid
join pg_catalog.pg_namespace as function_schema
  on function_schema.oid = trigger_function.pronamespace
where
  not trigger_name.tgisinternal
  and trigger_name.tgname = 'orders_broadcast_new_order'
  and table_schema.nspname = 'public'
  and protected_table.relname = 'orders';

-- Attese: RLS già attiva su realtime.messages e una policy SELECT riservata
-- ad authenticated, limitata a Broadcast, topic admin:orders e admin helper.
select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.cmd = 'SELECT' as is_select_policy,
  policy.roles = array['authenticated']::pg_catalog.name[]
    as authenticated_only,
  policy.qual ilike '%extension%broadcast%' as broadcast_only,
  policy.qual ilike '%realtime.topic()%' as checks_topic,
  policy.qual ilike '%admin:orders%' as expected_topic_only,
  policy.qual ilike '%private.is_admin()%' as uses_admin_helper
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'realtime'
  and policy.tablename = 'messages'
  and policy.policyname = 'orders_broadcast_receive_admin';

-- Attese: row_security_enabled = true e tutti i conteggi = 0.
-- Policy SELECT/ALL aggiuntive potrebbero ampliare l'accesso perché le policy
-- permissive PostgreSQL vengono combinate con OR e richiedono revisione.
select
  protected_table.relrowsecurity as row_security_enabled,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies as policy
    where
      policy.schemaname = 'realtime'
      and policy.tablename = 'messages'
      and policy.cmd in ('SELECT', 'ALL')
      and policy.policyname <> 'orders_broadcast_receive_admin'
  ) as unexpected_receive_policy_count,
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies as policy
    where
      policy.schemaname = 'realtime'
      and policy.tablename = 'messages'
      and policy.cmd in ('SELECT', 'ALL')
      and policy.roles && array['public', 'anon']::pg_catalog.name[]
  ) as anon_or_public_receive_policy_count
from pg_catalog.pg_class as protected_table
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = protected_table.relnamespace
where
  schema_name.nspname = 'realtime'
  and protected_table.relname = 'messages';

-- Attese: helper_count = 1 e authenticated può invocarlo per la valutazione
-- della policy; auth.uid() continua a essere verificato dall'helper esistente.
select
  pg_catalog.count(*) as helper_count,
  pg_catalog.bool_and(
    pg_catalog.has_function_privilege(
      'authenticated', routine.oid, 'EXECUTE'
    )
  ) as authenticated_can_execute_helper
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as schema_name
  on schema_name.oid = routine.pronamespace
where
  schema_name.nspname = 'private'
  and routine.proname = 'is_admin'
  and routine.prokind = 'f'
  and routine.pronargs = 0;

-- Attesa: una riga. La migrazione 011 non rimuove public.orders dalla
-- publication Postgres Changes durante la fase di coesistenza controllata.
select
  publication_table.pubname,
  publication_table.schemaname,
  publication_table.tablename
from pg_catalog.pg_publication_tables as publication_table
where
  publication_table.pubname = 'supabase_realtime'
  and publication_table.schemaname = 'public'
  and publication_table.tablename = 'orders';
