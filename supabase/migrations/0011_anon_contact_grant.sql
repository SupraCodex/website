-- 0011_anon_contact_grant.sql
-- il manquait le grant INSERT. Lecture de la table toujours interdite à anon (401 attendu).
grant insert on public.contact_messages to anon;
