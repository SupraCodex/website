-- 0010_public_read_grants.sql
-- les contenus PUBLIÉS (RLS 0008 limite déjà aux statuts publics). Sans ce grant,
-- PostgREST renvoie 401 au lieu des lignes filtrées. Écriture toujours interdite à anon.
grant select on public.content_items, public.content_tags to anon, authenticated;
