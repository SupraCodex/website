-- 0015_preview_tokens.sql
-- Un token unique (uuid) donne accès temporaire à un contenu non publié.
-- Non indexable (robots noindex via réponse), expiration automatique.
-- Aucune donnée personnelle : seul le content_id est référencé.

create table if not exists public.preview_tokens (
    id          uuid primary key default gen_random_uuid(),
    content_id  uuid not null references public.content_items (id) on delete cascade,
    created_by  uuid references public.profiles (id),
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now()
);

create index if not exists preview_tokens_content_key on public.preview_tokens (content_id);
create index if not exists preview_tokens_expires_key on public.preview_tokens (expires_at);

comment on table public.preview_tokens is 'Tokens de prévisualisation protégée (contenus non publiés)';

-- Grant : lecture/écriture par le serveur uniquement (service_role via RLS bypass).
grant select, insert, delete on public.preview_tokens to authenticated;
