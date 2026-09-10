-- 0007_audit_events.sql
-- Conserve l'acteur, l'action, le type de ressource, l'identifiant, l'horodatage,
-- Ne contient pas de mots de passe, tokens, contenu complet des messages ni secrets.

create table if not exists public.audit_events (
    id             uuid primary key default gen_random_uuid(),
    actor_id       uuid references public.profiles (id),
    actor_role     text,  -- rôle au moment de l'action (copie non sensible)
    action         text not null,
    resource_type  text not null,
    resource_id    text,
    result         text not null default 'success',
    summary        text,  -- résumé non sensible
    request_id     text,
    occurred_at    timestamptz not null default now(),
    created_at     timestamptz not null default now()
);

create index if not exists audit_events_actor_key on public.audit_events (actor_id);
create index if not exists audit_events_resource_key on public.audit_events (resource_type, resource_id);
create index if not exists audit_events_occurred_key on public.audit_events (occurred_at);

comment on table public.audit_events is 'Journal d''activité (traçabilité non sensible)';