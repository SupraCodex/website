-- ----------------------------------------------------------------
-- 0017 — Moindre privilège sur les tables sensibles
-- Correctif d'audit : la migration 0009 accordait `grant all` au rôle
-- `authenticated`. Le RLS restait la barrière effective, mais les privilèges
-- Écritures réelles : effectuées côté serveur via le rôle de service.
-- ----------------------------------------------------------------

revoke all on public.roles from authenticated;
revoke all on public.profiles from authenticated;
revoke all on public.role_assignments from authenticated;
revoke all on public.site_settings from authenticated;
revoke all on public.redirects from authenticated;
revoke all on public.audit_events from authenticated;

-- Référentiels et journal : lecture seule (filtrée ensuite par RLS).
grant select on public.roles to authenticated;
grant select on public.role_assignments to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.redirects to authenticated;
grant select on public.site_settings to authenticated;

-- Profils : lecture + mise à jour de sa propre fiche (RLS `self_update_profile`).
grant select, update on public.profiles to authenticated;

-- Paramètres et redirections : administration via le rôle de service uniquement.
grant insert, update, delete on public.site_settings to service_role;
grant insert, update, delete on public.redirects to service_role;
