-- Coffee Break Monza
-- Casi dimostrativi per public.create_public_order().
--
-- L'intero file è commentato e non deve essere eseguito automaticamente.
-- Sostituire i placeholder soltanto in un ambiente di test controllato.
-- I dati cliente sono fittizi. Ogni test che crea un ordine modifica il DB.

-- 1. Pickup valido. Atteso: order_id, order_number e totale calcolato.
-- select *
-- from public.create_public_order(
--   p_fulfillment_type => 'pickup',
--   p_customer_name => 'Cliente Test Pickup',
--   p_customer_phone => '0000000000',
--   p_requested_date => date '2099-03-01',
--   p_items => '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":2,"customer_notes":"Nota test"}]'::jsonb
-- );

-- 2. Delivery valido. Atteso: tariffa interna di consegna pari a 2.50.
-- select *
-- from public.create_public_order(
--   p_fulfillment_type => 'delivery',
--   p_customer_name => 'Cliente Test Delivery',
--   p_customer_phone => '0000000000',
--   p_requested_date => date '2099-03-01',
--   p_items => '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1}]'::jsonb,
--   p_delivery_address => 'Via Test 0',
--   p_delivery_city => 'Città Test',
--   p_delivery_postal_code => '00000'
-- );

-- 3. Array vuoto. Atteso: INVALID_ITEMS.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01', '[]'::jsonb
-- );

-- 4. Piatto non disponibile. Atteso: ITEM_NOT_AVAILABLE.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_NON_DISPONIBILE>","quantity":1}]'::jsonb
-- );

-- 5. UUID inesistente. Atteso: ITEM_NOT_AVAILABLE dopo la sostituzione con
-- un UUID sintatticamente valido che non appartiene ad alcun piatto.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_INESISTENTE>","quantity":1}]'::jsonb
-- );

-- 6. Quantità zero. Atteso: INVALID_ITEMS.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":0}]'::jsonb
-- );

-- 7. Quantità negativa. Atteso: INVALID_ITEMS.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":-1}]'::jsonb
-- );

-- 8. Quantità eccessiva. Atteso: INVALID_ITEMS.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":100}]'::jsonb
-- );

-- 9. ID duplicato. Atteso: INVALID_ITEMS, senza sommare le quantità.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1},{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":2}]'::jsonb
-- );

-- 10. Prezzo falso nel JSON. Atteso: INVALID_ITEMS, campo vietato.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1,"unit_price":0.01}]'::jsonb
-- );

-- 11. Totale falso nel JSON. Atteso: INVALID_ITEMS, campo vietato.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1,"line_total":0.01}]'::jsonb
-- );

-- 12. Delivery senza indirizzo. Atteso: INVALID_CUSTOMER_DATA.
-- select *
-- from public.create_public_order(
--   p_fulfillment_type => 'delivery',
--   p_customer_name => 'Cliente Test',
--   p_customer_phone => '0000000000',
--   p_requested_date => date '2099-03-01',
--   p_items => '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1}]'::jsonb,
--   p_delivery_city => 'Città Test',
--   p_delivery_postal_code => '00000'
-- );

-- 13. Pickup con dati consegna. Atteso: ordine valido; i dati consegna
-- vengono ignorati e salvati come null, pagamento on_pickup e tariffa zero.
-- select *
-- from public.create_public_order(
--   p_fulfillment_type => 'pickup',
--   p_customer_name => 'Cliente Test',
--   p_customer_phone => '0000000000',
--   p_requested_date => date '2099-03-01',
--   p_items => '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1}]'::jsonb,
--   p_delivery_address => 'Via Test 0',
--   p_delivery_city => 'Città Test',
--   p_delivery_postal_code => '00000'
-- );

-- 14. Data passata rispetto a Europe/Rome. Atteso: INVALID_REQUEST_DATE.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2000-01-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1}]'::jsonb
-- );

-- 15. Rollback con una riga invalida. Atteso: ITEM_NOT_AVAILABLE e nessuna
-- riga aggiunta a orders o order_items. Verificare i conteggi separatamente.
-- select *
-- from public.create_public_order(
--   'pickup', 'Cliente Test', '0000000000', date '2099-03-01',
--   '[{"menu_item_id":"<UUID_PIATTO_DISPONIBILE>","quantity":1},{"menu_item_id":"<UUID_INESISTENTE>","quantity":1}]'::jsonb
-- );
