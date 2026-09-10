-- -------------------------------------------------------------------
-- 0019_harden_rls.sql
-- Correctif d'audit : active la RLS sur les tables créées sans RLS
-- (contact_audit_events, preview_tokens) et restreint l'exécution des
-- fonctions SECURITY DEFINER au seul rôle authenticated (plus d'appel
-- direct par anon / public, qui pourrait divulguer les informations de rôle).
-- Idempotent : peut être réappliqué sans effet de bord.
-- -------------------------------------------------------------------

-- 1) contact_audit_events : aucune lecture/écriture cliente, écriture serveur
alter table public.contact_audit_events enable row level security;
alter table public.contact_audit_events force row level security;

drop policy if exists "server_insert_contact_audit" on public.contact_audit_events;
create policy "server_insert_contact_audit"
    on public.contact_audit_events for insert
    to service_role
    with check (true);

-- Lecture jamais exposée côté client : pas de policy anon/authenticated.
grant insert on public.contact_audit_events to service_role;
grant select on public.contact_audit_events to service_role;

-- 2) preview_tokens : travail exclusif côté serveur (service_role bypass RLS)
alter table public.preview_tokens enable row level security;
alter table public.preview_tokens force row level security;

drop policy if exists "service_all_preview_tokens" on public.preview_tokens;
create policy "service_all_preview_tokens"
    on public.preview_tokens for all
    to service_role
    with check (true);

-- Grants explicites (jamais anon/authenticated, déjà révoqués en 0018)
grant select, insert, delete on public.preview_tokens to service_role;

-- 3) Fonctions SECURITY DEFINER : plus d'EXECUTE hérité par PUBLIC/anon.
--    Elles restent appelables par authenticated (politiques par rôle).
revoke execute on function public.current_profile_id() from public, anon, authenticated;
revoke execute on function public.has_role(app_role) from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_editor() from public, anon, authenticated;
revoke execute on function public.is_reviewer() from public, anon, authenticated;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_role(app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_editor() to authenticated;
grant execute on function public.is_reviewer() to authenticated;

comment on table public.contact_audit_events is
    'Journal minimal des soumissions de contact (RLS : service_role uniquement, aucune lecture client)';
comment on table public.preview_tokens is
    'Tokens de prévisualisation (RLS : service_role uniquement)';