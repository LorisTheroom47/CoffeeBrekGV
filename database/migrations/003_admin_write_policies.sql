-- Coffee Break Monza
-- Policy amministrative di scrittura predisposte per revisione manuale.
-- Questa migrazione non è stata ancora applicata al database remoto.
--
-- Autenticazione e autorizzazione sono controlli distinti: appartenere al
-- ruolo authenticated non basta. Ogni scrittura richiede anche che esista
-- la riga personale dell'utente in public.admin_users.
--
-- Le policy restano separate per operazione per rendere espliciti i permessi
-- concessi e permettere verifiche indipendenti di INSERT, UPDATE e DELETE.
-- anon mantiene soltanto la lettura pubblica già prevista.

begin;

-- Normalizza i privilegi soltanto sulle due tabelle interessate.
-- SELECT viene mantenuto per la lettura pubblica esistente.
revoke insert, update, delete, truncate, references, trigger
  on table
    public.menu_items,
    public.menu_item_allergens
  from public, anon;

revoke insert, update, delete, truncate, references, trigger
  on table
    public.menu_items,
    public.menu_item_allergens
  from public, authenticated;

grant select
  on table
    public.menu_items,
    public.menu_item_allergens
  to anon, authenticated;

grant insert, update, delete
  on table public.menu_items
  to authenticated;

grant insert, delete
  on table public.menu_item_allergens
  to authenticated;

drop policy if exists menu_items_insert_admin
  on public.menu_items;

create policy menu_items_insert_admin
on public.menu_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists menu_items_update_admin
  on public.menu_items;

create policy menu_items_update_admin
on public.menu_items
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists menu_items_delete_admin
  on public.menu_items;

create policy menu_items_delete_admin
on public.menu_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

drop policy if exists menu_item_allergens_insert_admin
  on public.menu_item_allergens;

create policy menu_item_allergens_insert_admin
on public.menu_item_allergens
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

-- La chiave primaria composta identifica direttamente l'associazione.
-- Le modifiche future useranno DELETE + INSERT, quindi UPDATE non viene
-- concesso e non richiede una policy dedicata in questa fase.
drop policy if exists menu_item_allergens_delete_admin
  on public.menu_item_allergens;

create policy menu_item_allergens_delete_admin
on public.menu_item_allergens
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where admin_users.user_id = (select auth.uid())
  )
);

commit;
