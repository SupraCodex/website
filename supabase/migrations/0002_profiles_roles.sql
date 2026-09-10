-- 0002_profiles_roles.sql
--   admin, editor, reviewer, readonly.
-- Aucun secret. Les mots de passe appartiennent à Supabase Auth (auth.users),
-- cette migration ne crée aucun utilisateur.

-- Types énumérés des rôles
do $$
begin
    if not exists (select 1 from pg_type where typname = 'app_role') then
        create type app_role as enum ('admin', 'editor', 'reviewer', 'readonly');
    end if;
end$$;

-- Table des rôles (catalogue)
create table if not exists public.roles (
    id          uuid primary key default gen_random_uuid(),
    code        app_role not null,
    label       text not null,
    description text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index if not exists roles_code_key on public.roles (code);

-- Profil de compte admin, lié à auth.users
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    email       text not null,
    full_name   text,
    role_id     uuid references public.roles (id),
    is_active   boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index if not exists profiles_email_key on public.profiles (lower(email));

-- Association profile <-> rôle (plusieurs-à-plusieurs)
create table if not exists public.role_assignments (
    id         uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles (id) on delete cascade,
    role_id    uuid not null references public.roles (id) on delete restrict,
    granted_at timestamptz not null default now(),
    granted_by uuid references public.profiles (id)
);

create unique index if not exists role_assignments_profile_role_key
    on public.role_assignments (profile_id, role_id);

comment on table public.roles is 'Catalogue des rôles applicatifs';
comment on table public.profiles is 'Profil applicatif lié à un compte Supabase Auth';
comment on table public.role_assignments is 'Affectation d''un rôle à un profil';