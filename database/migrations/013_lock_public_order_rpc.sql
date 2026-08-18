-- CB-010B.2B - Limita la creazione degli ordini al backend fidato.
--
-- Applicare soltanto dopo avere configurato la Secret Key nel backend e avere
-- predisposto il passaggio della Server Action al client server-only.
-- Questa migrazione modifica esclusivamente i privilegi della RPC esistente.

begin;

revoke execute
  on function public.create_public_order(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.date,
    pg_catalog.jsonb,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.time,
    pg_catalog.text
  )
  from public, anon, authenticated;

grant execute
  on function public.create_public_order(
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.date,
    pg_catalog.jsonb,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.text,
    pg_catalog.time,
    pg_catalog.text
  )
  to service_role;

commit;
