-- 0004_projects_expertises.sql
-- Relation plusieurs-à-plusieurs projects <-> expertises et project_media (associations).

-- Expertises
create table if not exists public.expertises (
    id            uuid primary key default gen_random_uuid(),
    slug          text not null,
    title         text not null,
    summary       text,
    description   text,
    icon_key      text,  -- identifiant d'icône, pas un média binaire
    status        content_status not null default 'draft',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create unique index if not exists expertises_slug_key on public.expertises (slug);

-- Projets (réalisations)
create table if not exists public.projects (
    id                 uuid primary key default gen_random_uuid(),
    slug               text not null,
    title              text not null,
    summary            text,
    description        text,
    problem_statement  text,
    solution           text,
    outcome            text,
    confidentiality    text not null default 'public',  -- gouvernance, pas une note libre
    featured           boolean not null default false,
    cover_media_id     uuid,  -- référencé ensuite (0005_media_assets)
    status             content_status not null default 'draft',
    published_at       timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create unique index if not exists projects_slug_key on public.projects (slug);
create index if not exists projects_featured_key on public.projects (featured) where status = 'published';
create index if not exists projects_published_key on public.projects (status, published_at);

-- Association projet <-> expertise
create table if not exists public.project_expertises (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid not null references public.projects (id) on delete cascade,
    expertise_id uuid not null references public.expertises (id) on delete restrict
);

create unique index if not exists project_expertises_key on public.project_expertises (project_id, expertise_id);

-- Association projet <-> tag
create table if not exists public.project_tags (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    tag_id     uuid not null references public.tags (id) on delete restrict
);

create unique index if not exists project_tags_key on public.project_tags (project_id, tag_id);

comment on table public.expertises is 'Pages de services / domaines d''expertise';
comment on table public.projects is 'Réalisations du portfolio';
comment on table public.project_expertises is 'Association projet/expertise';
comment on table public.project_tags is 'Association projet/tag';