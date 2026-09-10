-- 0018_preview_tokens_least_privilege.sql
-- Durcissement : les jetons de prévisualisation sont manipulés uniquement
-- par le backend avec la clé service_role. Les rôles clients ne doivent
-- disposer d'aucun privilège direct sur cette table.
revoke all on public.preview_tokens from anon, authenticated;

-- Le rôle service_role contourne RLS mais conserve ses privilèges explicites.
grant select, insert, delete on public.preview_tokens to service_role;
