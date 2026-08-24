-- Coffee Break GV
-- Bucket e policy Storage per le fotografie dei piatti.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

-- Le immagini sono contenuti pubblici del menu, ma nessun visitatore anonimo
-- può creare, sostituire o eliminare oggetti. Il limite è replicato anche
-- nell'applicazione per fornire un errore leggibile prima dell'upload.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'menu-images',
  'menu-images',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists menu_images_insert_admin
  on storage.objects;

create policy menu_images_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'menu-images'
  and name ~ '^menu-items/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and (select private.is_admin())
);

drop policy if exists menu_images_delete_admin
  on storage.objects;

create policy menu_images_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'menu-images'
  and name ~ '^menu-items/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and (select private.is_admin())
);

comment on column public.menu_items.image_url
is 'Percorso relativo nel bucket pubblico menu-images; generato esclusivamente dal backend amministrativo.';

commit;
