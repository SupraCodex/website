-- 0005_media_assets.sql
-- type MIME, taille, largeur, hauteur, texte alternatif, légende, source,
-- licence, auteur, date d'import.
-- Buckets : public (médias publiés), private (brouillons/originaux), archive.

create table if not exists public.media_assets (
    id            uuid primary key default gen_random_uuid(),
    logical_name  text not null,
    storage_path  text not null,
    extension     text not null,
    mime_type     text not null,
    size_bytes    bigint not null default 0 check (size_bytes >= 0),
    width         integer check (width is null or width > 0),
    height        integer check (height is null or height > 0),
    alt_text      text,  -- texte alternatif (fonction de l'image)
    caption       text,
    is_decorative boolean not null default false,
    source        text,  -- origine documentée (autorisation requise pour le réel)
    license       text,
    author        text,
    visibility    text not null default 'private' check (visibility in ('public', 'private', 'archive')),
    imported_at   timestamptz not null default now(),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create unique index if not exists media_assets_storage_path_key on public.media_assets (storage_path);
create index if not exists media_assets_visibility_key on public.media_assets (visibility);

-- Galerie projet (avec ordre)
create table if not exists public.project_media (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    media_id   uuid not null references public.media_assets (id) on delete restrict,
    position   integer not null default 0
);

create unique index if not exists project_media_key on public.project_media (project_id, media_id);
create index if not exists project_media_position_key on public.project_media (project_id, position);

comment on table public.media_assets is 'Métadonnées des fichiers médias (fichiers dans Storage)';
comment on table public.project_media is 'Galerie d''images d''un projet';

-- Attache les clés étrangères des couvertures (déclarées en 0003/0004 après création de media_assets)
alter table public.content_items
    add constraint content_items_cover_media_fk
    foreign key (cover_media_id) references public.media_assets (id) on delete set null;

alter table public.projects
    add constraint projects_cover_media_fk
    foreign key (cover_media_id) references public.media_assets (id) on delete set null;