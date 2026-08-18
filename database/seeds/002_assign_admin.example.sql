-- Coffee Break Monza
-- MODELLO DA COMPILARE: non eseguire senza aver sostituito il placeholder.
--
-- 1. Aprire Supabase Dashboard.
-- 2. Andare in Authentication -> Users.
-- 3. Copiare l'UUID dell'utente gia creato.
-- 4. Sostituire REPLACE_WITH_AUTH_USER_UUID con quell'UUID.
-- 5. Eseguire manualmente la query compilata nel Supabase SQL Editor.
--
-- Non inserire email, password, token o altre credenziali in questo file.

insert into public.admin_users (user_id)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid)
on conflict (user_id) do nothing;
