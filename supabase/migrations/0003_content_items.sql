-- 0003_content_items.sql
-- tags et redirections.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'content_type') then
        create type content_type as enum ('article', 'announcement', 'career');
    end if;
    if not exists (select 1 from pg_type where typname = 'content_status') then
        create type content_status as enum ('draft', 'review', 'published', 'archived');
    end if;
end$$;

-- Catégories (contrôlées)
create table if not exists public.categories (
    id           uuid primary key default gen_random_uuid(),
    slug         text not null,
    label        text not null,
    content_type content_type not null,
    created_at   timestamptz not null default now()
);

create unique index if not exists categories_slug_key on public.categories (slug, content_type);

-- Tags contrôlés (technologies, etc.)
create table if not exists public.tags (
    id         uuid primary key default gen_random_uuid(),
    slug       text not null,
    label      text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists tags_slug_key on public.tags (slug);

-- Contenus éditoriaux unifiés
create table if not exists public.content_items (
    id              uuid primary key default gen_random_uuid(),
    type            content_type not null,
    slug            text not null,
    title           text not null,
    excerpt         text not null,
    body            jsonb not null default '[]',
    status          content_status not null default 'draft',
    author_id       uuid references public.profiles (id),
    category_id     uuid references public.categories (id),
    cover_media_id  uuid,  -- référencé plus tard (0005_media_assets)
    published_at    timestamptz,
    archived_at     timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create unique index if not exists content_items_slug_type_key on public.content_items (slug, type);
create index if not exists content_items_status_published_key on public.content_items (status, published_at);
create index if not exists content_items_category_key on public.content_items (category_id);
create index if not exists content_items_author_key on public.content_items (author_id);

-- Association contenu <-> tag
create table if not exists public.content_tags (
    id         uuid primary key default gen_random_uuid(),
    content_id uuid not null references public.content_items (id) on delete cascade,
    tag_id     uuid not null references public.tags (id) on delete restrict
);

create unique index if not exists content_tags_content_tag_key on public.content_tags (content_id, tag_id);

-- Redirections (ancien chemin -> nouvel élément)
create table if not exists public.redirects (
    id         uuid primary key default gen_random_uuid(),
    old_path   text not null,
    target     text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists redirects_old_path_key on public.redirects (old_path);

comment on table public.content_items is 'Contenus éditoriaux (articles, annonces, carrières)';
comment on table public.content_tags is 'Association contenu/tag';
comment on table public.redirects is 'Redirections d''anciennes URLs après changement de slug';