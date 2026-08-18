-- Coffee Break Monza
-- Dati iniziali ripetibili derivati dal menu dimostrativo e dai dati pubblici.

begin;

insert into public.allergens (code, name)
values
  (1, 'Glutine'),
  (2, 'Crostacei'),
  (3, 'Uova'),
  (4, 'Pesce'),
  (5, 'Arachidi'),
  (6, 'Soia'),
  (7, 'Latte'),
  (8, 'Frutta a guscio'),
  (9, 'Sedano'),
  (10, 'Senape'),
  (11, 'Semi di sesamo'),
  (12, 'Anidride solforosa e solfiti'),
  (13, 'Lupini'),
  (14, 'Molluschi')
on conflict (code) do update
set
  name = excluded.name,
  updated_at = now();

insert into public.categories (name, slug, display_order)
values
  ('Primi', 'primi', 1),
  ('Secondi', 'secondi', 2),
  ('Contorni', 'contorni', 3),
  ('Piatti unici', 'piatti-unici', 4)
on conflict (slug) do update
set
  name = excluded.name,
  display_order = excluded.display_order,
  updated_at = now();

create temporary table seed_menu_items (
  category_slug text not null,
  name text not null,
  price numeric(10, 2) not null,
  available boolean not null,
  display_order integer not null
) on commit drop;

insert into seed_menu_items (
  category_slug,
  name,
  price,
  available,
  display_order
)
values
  ('primi', 'Lasagne al ragù', 8.50, true, 1),
  ('primi', 'Risotto alla milanese', 8.00, true, 2),
  ('secondi', 'Cotoletta con patate', 10.00, true, 1),
  ('secondi', 'Pollo alla griglia', 9.00, true, 2),
  ('contorni', 'Verdure grigliate', 4.00, true, 1),
  ('contorni', 'Patate al forno', 4.00, true, 2),
  ('piatti-unici', 'Insalatona Coffee Break', 9.50, true, 1),
  ('piatti-unici', 'Piatto vegetariano', 9.00, false, 2);

update public.menu_items as menu_item
set
  price = seed.price,
  available = seed.available,
  display_order = seed.display_order,
  updated_at = now()
from seed_menu_items as seed
join public.categories as category
  on category.slug = seed.category_slug
where
  menu_item.category_id = category.id
  and menu_item.name = seed.name;

insert into public.menu_items (
  category_id,
  name,
  description,
  price,
  available,
  display_order,
  image_url
)
select
  category.id,
  seed.name,
  null,
  seed.price,
  seed.available,
  seed.display_order,
  null
from seed_menu_items as seed
join public.categories as category
  on category.slug = seed.category_slug
where not exists (
  select 1
  from public.menu_items as existing_item
  where
    existing_item.category_id = category.id
    and existing_item.name = seed.name
);

-- I dati pubblici affidabili sono limitati a nome, indirizzo e servizio.
-- Telefono, email e orari non vengono inseriti perché ancora in aggiornamento.
insert into public.settings (key, value, description, is_public)
values
  (
    'restaurant_name',
    '"Coffee Break Monza"'::jsonb,
    'Nome pubblico del locale',
    true
  ),
  (
    'restaurant_address',
    '"Via Pergolesi 33, Monza"'::jsonb,
    'Indirizzo pubblico del locale',
    true
  ),
  (
    'restaurant_service',
    '"Pranzo"'::jsonb,
    'Servizio principale del locale',
    true
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();

commit;
