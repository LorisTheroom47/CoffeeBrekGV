-- Coffee Break Monza
-- Controlli di sola lettura per la publication Realtime degli ordini.
-- Risultato atteso: entrambe le query restituiscono una riga.

select
  pubname,
  pubinsert
from pg_catalog.pg_publication
where pubname = 'supabase_realtime'
  and pubinsert is true;

select
  pubname,
  schemaname,
  tablename
from pg_catalog.pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'orders';
