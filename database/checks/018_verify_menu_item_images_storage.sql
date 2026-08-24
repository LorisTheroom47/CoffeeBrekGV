-- Coffee Break GV
-- Controlli di sola lettura per la migrazione 018.

select
  bucket.id,
  bucket.name,
  bucket.public as public_read_enabled,
  bucket.file_size_limit,
  bucket.allowed_mime_types
from storage.buckets as bucket
where bucket.id = 'menu-images';

select
  policy.policyname,
  policy.cmd,
  policy.roles,
  policy.qual,
  policy.with_check
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'storage'
  and policy.tablename = 'objects'
  and policy.policyname in (
    'menu_images_insert_admin',
    'menu_images_delete_admin'
  )
order by policy.policyname;

select count(*) as menu_images_policy_count
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'storage'
  and policy.tablename = 'objects'
  and policy.policyname in (
    'menu_images_insert_admin',
    'menu_images_delete_admin'
  )
  and policy.roles = array['authenticated']::name[]
  and coalesce(policy.qual, policy.with_check, '') like '%private.is_admin()%'
  and coalesce(policy.qual, policy.with_check, '') like '%menu-images%';

select count(*) as anon_or_public_menu_images_write_policy_count
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'storage'
  and policy.tablename = 'objects'
  and policy.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (
    'public' = any(policy.roles)
    or 'anon' = any(policy.roles)
  )
  and (
    coalesce(policy.qual, '') like '%menu-images%'
    or coalesce(policy.with_check, '') like '%menu-images%'
  );

select count(*) as order_operator_menu_images_policy_count
from pg_catalog.pg_policies as policy
where
  policy.schemaname = 'storage'
  and policy.tablename = 'objects'
  and policy.policyname in (
    'menu_images_insert_admin',
    'menu_images_delete_admin'
  )
  and (
    coalesce(policy.qual, '') ilike '%order_operator%'
    or coalesce(policy.with_check, '') ilike '%order_operator%'
    or coalesce(policy.qual, '') ilike '%can_manage_orders%'
    or coalesce(policy.with_check, '') ilike '%can_manage_orders%'
  );

select count(*) as menu_items_image_url_column_count
from information_schema.columns as column_info
where
  column_info.table_schema = 'public'
  and column_info.table_name = 'menu_items'
  and column_info.column_name = 'image_url'
  and column_info.is_nullable = 'YES'
  and column_info.data_type = 'text';
