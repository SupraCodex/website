-- 0014_contact_audit.sql
-- Aucune donnée personnelle : uniquement l'événement, la classe de résultat,
-- l'empreinte d'identité (non réversible) et le request ID.

create table if not exists public.contact_audit_events (
    id            uuid primary key default gen_random_uuid(),
    event         text not null check (event in ('contact_submit', 'contact_confirm')),
    result        text not null check (result in ('accepted', 'rate_limited', 'invalid', 'email_unavailable')),
    identity_hash text,  -- empreinte non réversible (rate limit), pas d'IP en clair
    request_id    text,
    occurred_at   timestamptz not null default now(),
    created_at    timestamptz not null default now()
);

create index if not exists contact_audit_occurred_key on public.contact_audit_events (occurred_at);
create index if not exists contact_audit_event_key on public.contact_audit_events (event, result);

comment on table public.contact_audit_events is 'Journal minimal des soumissions de contact (sans données personnelles)';
