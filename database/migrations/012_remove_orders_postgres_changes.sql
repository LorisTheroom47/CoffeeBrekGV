-- Coffee Break Monza
-- Rimuove public.orders dalla publication Postgres Changes ora deprecata.
-- Broadcast privato resta l'unico percorso Realtime per i nuovi ordini.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'Publication supabase_realtime not found';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime drop table public.orders;
  end if;
end
$migration$;

commit;
