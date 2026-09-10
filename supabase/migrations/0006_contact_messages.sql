-- 0006_contact_messages.sql
-- Champs : nom, email, sujet, message, honeypot, statut, assignation.

create table if not exists public.contact_messages (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    email        text not null,
    subject      text not null,
    message      text not null,
    -- honeypot : champ décoratif devant rester vide (anti-bot)
    website      text not null default '',
    status       text not null default 'new' check (status in ('new', 'in_progress', 'done', 'archived')),
    assigned_to  uuid references public.profiles (id),
    source_ip    text,  -- utilisé pour le rate limit, non exposé publiquement
    received_at  timestamptz not null default now(),
    last_action_at timestamptz not null default now(),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists contact_messages_status_key on public.contact_messages (status);
create index if not exists contact_messages_received_key on public.contact_messages (received_at);

comment on table public.contact_messages is 'Messages reçus via le formulaire de contact';

-- destructive n'est implémentée ici sans procédure validée.