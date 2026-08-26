-- Coffee Break GV
-- Controlli di sola lettura per la riclassificazione delle categorie obsolete.
-- Non modifica dati, schema o privilegi.

-- Atteso: zero righe.
select
  category.name,
  category.slug
from public.categories as category
where category.name in ('Tavola fredda', 'Tavola calda')
order by category.name;

-- Attese: 8 righe nell'ordine indicato e order_is_correct = true.
with expected_categories(name, expected_order) as (
  values
    ('Primi'::pg_catalog.text, 1::pg_catalog.int4),
    ('Secondi'::pg_catalog.text, 2::pg_catalog.int4),
    ('Insalate'::pg_catalog.text, 3::pg_catalog.int4),
    ('Panini'::pg_catalog.text, 4::pg_catalog.int4),
    ('Piadine'::pg_catalog.text, 5::pg_catalog.int4),
    ('Bevande'::pg_catalog.text, 6::pg_catalog.int4),
    ('Brioches di pasticceria'::pg_catalog.text, 7::pg_catalog.int4),
    ('Prodotti senza glutine'::pg_catalog.text, 8::pg_catalog.int4)
)
select
  expected_category.expected_order,
  expected_category.name,
  category.display_order,
  category.id is not null as category_present,
  category.display_order = expected_category.expected_order
    as order_is_correct
from expected_categories as expected_category
left join public.categories as category
  on category.name = expected_category.name
order by expected_category.expected_order;

-- Atteso: una riga, conferma che Caffetteria è rimasta presente.
select
  category.name,
  category.slug,
  category.display_order
from public.categories as category
where category.name = 'Caffetteria';

-- Attese: 11 righe, tutte con expected_category = actual_category.
with expected_items(name, expected_category, expected_order) as (
  values
    ('Focaccia farcita'::pg_catalog.text, 'Panini'::pg_catalog.text, 1),
    ('Panino base'::pg_catalog.text, 'Panini'::pg_catalog.text, 2),
    ('Panino crudo e bresaola'::pg_catalog.text, 'Panini'::pg_catalog.text, 3),
    ('Toast'::pg_catalog.text, 'Panini'::pg_catalog.text, 4),
    ('Toast farcito'::pg_catalog.text, 'Panini'::pg_catalog.text, 5),
    ('Tramezzini'::pg_catalog.text, 'Panini'::pg_catalog.text, 6),
    ('Insalatona'::pg_catalog.text, 'Insalate'::pg_catalog.text, 7),
    ('Piatto caprese'::pg_catalog.text, 'Insalate'::pg_catalog.text, 8),
    ('Poke'::pg_catalog.text, 'Insalate'::pg_catalog.text, 9),
    ('Piadina'::pg_catalog.text, 'Piadine'::pg_catalog.text, 10),
    ('Piadina crudo e bresaola'::pg_catalog.text, 'Piadine'::pg_catalog.text, 11)
)
select
  expected_item.name,
  expected_item.expected_category,
  category.name as actual_category,
  category.name = expected_item.expected_category as category_is_correct
from expected_items as expected_item
left join public.menu_items as menu_item
  on menu_item.name = expected_item.name
left join public.categories as category
  on category.id = menu_item.category_id
order by expected_item.expected_order;

-- Attese: tutti true e total_items = 11.
with expected_items(name, expected_category) as (
  values
    ('Focaccia farcita'::pg_catalog.text, 'Panini'::pg_catalog.text),
    ('Panino base'::pg_catalog.text, 'Panini'::pg_catalog.text),
    ('Panino crudo e bresaola'::pg_catalog.text, 'Panini'::pg_catalog.text),
    ('Toast'::pg_catalog.text, 'Panini'::pg_catalog.text),
    ('Toast farcito'::pg_catalog.text, 'Panini'::pg_catalog.text),
    ('Tramezzini'::pg_catalog.text, 'Panini'::pg_catalog.text),
    ('Insalatona'::pg_catalog.text, 'Insalate'::pg_catalog.text),
    ('Piatto caprese'::pg_catalog.text, 'Insalate'::pg_catalog.text),
    ('Poke'::pg_catalog.text, 'Insalate'::pg_catalog.text),
    ('Piadina'::pg_catalog.text, 'Piadine'::pg_catalog.text),
    ('Piadina crudo e bresaola'::pg_catalog.text, 'Piadine'::pg_catalog.text)
), actual_items as (
  select
    menu_item.id,
    menu_item.name,
    category.name as category_name
  from public.menu_items as menu_item
  join public.categories as category
    on category.id = menu_item.category_id
  where menu_item.name in (select expected_item.name from expected_items as expected_item)
)
select
  (select pg_catalog.count(*) from actual_items) = 11
    as all_items_present_once,
  not exists (
    select 1
    from expected_items as expected_item
    left join actual_items as actual_item
      on actual_item.name = expected_item.name
    where
      actual_item.id is null
      or actual_item.category_name <> expected_item.expected_category
  ) as all_items_are_reclassified;

-- Atteso: zero. I riferimenti dei menu giornalieri restano validi perché gli
-- ID dei piatti non vengono sostituiti.
select pg_catalog.count(*) as orphan_daily_menu_item_count
from public.daily_menu_items as daily_menu_item
left join public.menu_items as menu_item
  on menu_item.id = daily_menu_item.menu_item_id
where menu_item.id is null;
