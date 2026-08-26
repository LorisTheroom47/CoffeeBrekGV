-- Coffee Break GV
-- Riclassificazione fail-closed delle categorie Tavola fredda e Tavola calda.
-- Migrazione predisposta per revisione e applicazione manuale.

begin;

do $migration$
declare
  v_cold_category_id pg_catalog.uuid;
  v_hot_category_id pg_catalog.uuid;
  v_insalate_category_id pg_catalog.uuid;
  v_panini_category_id pg_catalog.uuid;
  v_piadine_category_id pg_catalog.uuid;
  v_category_count pg_catalog.int4;
  v_item_count pg_catalog.int4;
  v_updated_count pg_catalog.int4;
  v_deleted_count pg_catalog.int4;
  v_expected_cold_items constant pg_catalog.text[] := array[
    'Focaccia farcita',
    'Insalatona',
    'Panino base',
    'Panino crudo e bresaola',
    'Piadina',
    'Piadina crudo e bresaola',
    'Piatto caprese',
    'Poke',
    'Toast',
    'Toast farcito',
    'Tramezzini'
  ]::pg_catalog.text[];
begin
  select pg_catalog.count(*)
  into v_category_count
  from public.categories as category
  where category.name = 'Tavola fredda';

  if v_category_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ONE_TAVOLA_FREDDA_CATEGORY';
  end if;

  select category.id
  into v_cold_category_id
  from public.categories as category
  where category.name = 'Tavola fredda';

  select pg_catalog.count(*)
  into v_category_count
  from public.categories as category
  where category.name = 'Tavola calda';

  if v_category_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ONE_TAVOLA_CALDA_CATEGORY';
  end if;

  select category.id
  into v_hot_category_id
  from public.categories as category
  where category.name = 'Tavola calda';

  select pg_catalog.count(*)
  into v_category_count
  from public.categories as category
  where category.name = 'Insalate';

  if v_category_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ONE_INSALATE_CATEGORY';
  end if;

  select category.id
  into v_insalate_category_id
  from public.categories as category
  where category.name = 'Insalate';

  select pg_catalog.count(*)
  into v_category_count
  from public.categories as category
  where category.name = 'Panini';

  if v_category_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ONE_PANINI_CATEGORY';
  end if;

  select category.id
  into v_panini_category_id
  from public.categories as category
  where category.name = 'Panini';

  select pg_catalog.count(*)
  into v_category_count
  from public.categories as category
  where category.name = 'Piadine';

  if v_category_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ONE_PIADINE_CATEGORY';
  end if;

  select category.id
  into v_piadine_category_id
  from public.categories as category
  where category.name = 'Piadine';

  if exists (
    select expected_category.name
    from pg_catalog.unnest(array[
      'Primi',
      'Secondi',
      'Insalate',
      'Panini',
      'Piadine',
      'Bevande',
      'Brioches di pasticceria',
      'Prodotti senza glutine'
    ]::pg_catalog.text[]) as expected_category(name)
    where (
      select pg_catalog.count(*)
      from public.categories as category
      where category.name = expected_category.name
    ) <> 1
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ORDERABLE_CATEGORIES_NOT_FOUND';
  end if;

  select pg_catalog.count(*)
  into v_category_count
  from public.categories as category
  where category.name = 'Caffetteria';

  if v_category_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_ONE_CAFFETTERIA_CATEGORY';
  end if;

  select pg_catalog.count(*)
  into v_item_count
  from public.menu_items as menu_item
  where menu_item.category_id = v_cold_category_id;

  if v_item_count <> 11 then
    raise exception using
      errcode = 'P0001',
      message = 'TAVOLA_FREDDA_ITEM_COUNT_MISMATCH';
  end if;

  if exists (
    select expected_item.name
    from pg_catalog.unnest(v_expected_cold_items) as expected_item(name)
    where (
      select pg_catalog.count(*)
      from public.menu_items as menu_item
      where
        menu_item.category_id = v_cold_category_id
        and menu_item.name = expected_item.name
    ) <> 1
  ) or exists (
    select 1
    from public.menu_items as menu_item
    where
      menu_item.category_id = v_cold_category_id
      and menu_item.name <> all(v_expected_cold_items)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'TAVOLA_FREDDA_ITEMS_MISMATCH';
  end if;

  select pg_catalog.count(*)
  into v_item_count
  from public.menu_items as menu_item
  where menu_item.category_id = v_hot_category_id;

  if v_item_count <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'TAVOLA_CALDA_NOT_EMPTY';
  end if;

  update public.menu_items
  set category_id = v_panini_category_id
  where
    category_id = v_cold_category_id
    and name in (
      'Focaccia farcita',
      'Panino base',
      'Panino crudo e bresaola',
      'Toast',
      'Toast farcito',
      'Tramezzini'
    );

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 6 then
    raise exception using
      errcode = 'P0001',
      message = 'PANINI_MOVE_COUNT_MISMATCH';
  end if;

  update public.menu_items
  set category_id = v_insalate_category_id
  where
    category_id = v_cold_category_id
    and name in ('Insalatona', 'Piatto caprese', 'Poke');

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 3 then
    raise exception using
      errcode = 'P0001',
      message = 'INSALATE_MOVE_COUNT_MISMATCH';
  end if;

  update public.menu_items
  set category_id = v_piadine_category_id
  where
    category_id = v_cold_category_id
    and name in ('Piadina', 'Piadina crudo e bresaola');

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'PIADINE_MOVE_COUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from public.menu_items as menu_item
    where menu_item.category_id in (v_cold_category_id, v_hot_category_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'OBSOLETE_CATEGORIES_STILL_CONTAIN_ITEMS';
  end if;

  update public.categories as category
  set display_order = expected_category.display_order
  from (
    values
      ('Primi'::pg_catalog.text, 1::pg_catalog.int4),
      ('Secondi'::pg_catalog.text, 2::pg_catalog.int4),
      ('Insalate'::pg_catalog.text, 3::pg_catalog.int4),
      ('Panini'::pg_catalog.text, 4::pg_catalog.int4),
      ('Piadine'::pg_catalog.text, 5::pg_catalog.int4),
      ('Bevande'::pg_catalog.text, 6::pg_catalog.int4),
      ('Brioches di pasticceria'::pg_catalog.text, 7::pg_catalog.int4),
      ('Prodotti senza glutine'::pg_catalog.text, 8::pg_catalog.int4)
  ) as expected_category(name, display_order)
  where category.name = expected_category.name;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 8 then
    raise exception using
      errcode = 'P0001',
      message = 'CATEGORY_ORDER_UPDATE_COUNT_MISMATCH';
  end if;

  delete from public.categories
  where id in (v_cold_category_id, v_hot_category_id);

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'OBSOLETE_CATEGORY_DELETE_COUNT_MISMATCH';
  end if;
end;
$migration$;

commit;
