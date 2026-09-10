-- 0008_rls_policies.sql
-- RLS activé sur toutes les tables exposées (jamais désactivé).

-- Paramètres de site contrôlés (clés autorisées, jamais secrets bruts)
create table if not exists public.site_settings (
    id         uuid primary key default gen_random_uuid(),
    key        text not null,
    value      text not null,
    is_public  boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists site_settings_key_key on public.site_settings (key);

-- Activation RLS et autorisations de base
alter table public.roles               enable row level security;
alter table public.profiles            enable row level security;
alter table public.role_assignments    enable row level security;
alter table public.categories          enable row level security;
alter table public.tags                enable row level security;
alter table public.content_items       enable row level security;
alter table public.content_tags        enable row level security;
alter table public.redirects           enable row level security;
alter table public.expertises          enable row level security;
alter table public.projects            enable row level security;
alter table public.project_expertises  enable row level security;
alter table public.project_tags        enable row level security;
alter table public.media_assets        enable row level security;
alter table public.project_media       enable row level security;
alter table public.contact_messages    enable row level security;
alter table public.audit_events        enable row level security;
alter table public.site_settings       enable row level security;

-- Lecture publique : contenus publiés (et publié à l'heure courante)
drop policy if exists "public_read_content" on public.content_items;
create policy "public_read_content"
    on public.content_items for select
    to anon, authenticated
    using (status = 'published' and (published_at is null or published_at <= now()));

drop policy if exists "public_read_expertises" on public.expertises;
create policy "public_read_expertises"
    on public.expertises for select
    to anon, authenticated
    using (status = 'published');

drop policy if exists "public_read_projects" on public.projects;
create policy "public_read_projects"
    on public.projects for select
    to anon, authenticated
    using (status = 'published');

-- Les visiteurs peuvent créer un message de contact mais pas lire la table
drop policy if exists "public_insert_contact" on public.contact_messages;
create policy "public_insert_contact"
    on public.contact_messages for insert
    to anon, authenticated
    with check (true);

-- Insertion des journaux côté serveur uniquement
drop policy if exists "server_insert_audit" on public.audit_events;
create policy "server_insert_audit"
    on public.audit_events for insert
    to service_role
    with check (true);

comment on table public.site_settings is 'Paramètres de site contrôlés (clés autorisées, pas de secrets)';