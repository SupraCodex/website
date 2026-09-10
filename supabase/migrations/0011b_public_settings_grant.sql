-- 0011_public_settings_grant.sql
-- avec la clé anon ; la RLS (0008) limite déjà les lignes à is_public = true.
-- Sans ce grant, PostgREST renvoie 401 au lieu des lignes publiques.
grant select on public.site_settings to anon, authenticated;
