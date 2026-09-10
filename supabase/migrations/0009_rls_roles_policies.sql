-- 0009_rls_roles_policies.sql
-- Un utilisateur désactivé (profiles.is_active = false) ne reçoit plus aucun privilège
-- service_role reste côté serveur uniquement (jamais exposé au navigateur).

-- ----------------------------------------------------------------
-- 1. Fonctions d'aide (SECURITY DEFINER, search_path figé)
-- ----------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select p.id
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true;
$$;

create or replace function public.has_role(role_code app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.role_assignments ra
        join public.profiles p on p.id = ra.profile_id
        where p.id = auth.uid()
          and p.is_active = true
          and ra.role_id = (select r.id from public.roles r where r.code = role_code)
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.has_role('admin');
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.has_role('editor') or public.has_role('admin');
$$;

create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.has_role('reviewer') or public.has_role('admin');
$$;

comment on function public.current_profile_id() is 'Identifiant du profil actif (null si désactivé)';
comment on function public.has_role(app_role) is 'Vrai si l''utilisateur actif possède le rôle (utilisateur désactivé exclu)';
comment on function public.is_admin() is 'Vrai si l''utilisateur actif est administrateur';

-- ----------------------------------------------------------------
-- 2. Grants (privilèges explicites, pas de ALL élargi au public)
-- ----------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Lecture publique (anon) : catalogues et contenus publiés
grant select on public.categories, public.tags to anon, authenticated;
grant select on public.expertises, public.projects, public.project_expertises, public.project_tags to anon, authenticated;
grant select on public.project_media to anon, authenticated;
grant select on public.media_assets to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;

-- Rôles applicatifs : lecture catalogue ; écriture réservée à l'admin
grant select on public.roles to authenticated;
grant all on public.roles to authenticated;
grant all on public.profiles to authenticated;
grant all on public.role_assignments to authenticated;
grant all on public.site_settings to authenticated;
grant all on public.redirects to authenticated;
grant all on public.audit_events to authenticated;
grant select, insert, update, delete on
    public.content_items, public.content_tags,
    public.expertises, public.projects,
    public.project_expertises, public.project_tags,
    public.project_media, public.media_assets
    to authenticated;
grant select on public.content_items, public.expertises, public.projects, public.media_assets to authenticated;
grant select, update on public.contact_messages to authenticated;

-- ----------------------------------------------------------------
-- 3. Profils, rôles, affectations
-- ----------------------------------------------------------------
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
    on public.profiles for select
    to authenticated
    using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
    on public.profiles for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid() and is_active = true);  -- un utilisateur ne peut pas se réactiver

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
    on public.profiles for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated"
    on public.roles for select
    to authenticated
    using (true);

drop policy if exists "roles_admin_all" on public.roles;
create policy "roles_admin_all"
    on public.roles for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "role_assignments_admin_all" on public.role_assignments;
create policy "role_assignments_admin_all"
    on public.role_assignments for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------
-- 4. Contenus éditoriaux
-- ----------------------------------------------------------------
-- Lecture : publiés pour tous (politique 0008), brouillons pour éditeur et relecteur
drop policy if exists "staff_read_content" on public.content_items;
create policy "staff_read_content"
    on public.content_items for select
    to authenticated
    using (public.is_editor() or public.is_reviewer());

-- Création : éditeur ou admin, toujours en brouillon (publication = route dédiée admin)
drop policy if exists "editor_insert_content" on public.content_items;
create policy "editor_insert_content"
    on public.content_items for insert
    to authenticated
    with check (public.is_editor() and status = 'draft');

-- Modification : éditeur sur ses propres brouillons/en revue ; admin sur tout
drop policy if exists "editor_update_own_drafts" on public.content_items;
create policy "editor_update_own_drafts"
    on public.content_items for update
    to authenticated
    using (public.has_role('editor') and author_id = auth.uid()
           and status in ('draft', 'review'))
    with check (public.has_role('editor') and status in ('draft', 'review'));

drop policy if exists "admin_all_content" on public.content_items;
create policy "admin_all_content"
    on public.content_items for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Suppression définitive : admin uniquement (couverte par admin_all_content)

-- Tags de contenu suivent les mêmes règles d'écriture
drop policy if exists "staff_read_content_tags" on public.content_tags;
create policy "staff_read_content_tags"
    on public.content_tags for select
    to authenticated
    using (true);

drop policy if exists "editor_write_content_tags" on public.content_tags;
create policy "editor_write_content_tags"
    on public.content_tags for insert
    to authenticated
    with check (public.is_editor());

drop policy if exists "editor_delete_content_tags" on public.content_tags;
create policy "editor_delete_content_tags"
    on public.content_tags for delete
    to authenticated
    using (public.is_editor());

drop policy if exists "admin_all_content_tags" on public.content_tags;
create policy "admin_all_content_tags"
    on public.content_tags for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Catégories et tags : lecture publique, écriture admin
drop policy if exists "admin_write_categories" on public.categories;
create policy "admin_write_categories"
    on public.categories for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "admin_write_tags" on public.tags;
create policy "admin_write_tags"
    on public.tags for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Redirections : lecture/écriture admin et service_role uniquement
drop policy if exists "admin_all_redirects" on public.redirects;
create policy "admin_all_redirects"
    on public.redirects for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------
-- 5. Expertises et projets
-- ----------------------------------------------------------------
drop policy if exists "staff_read_expertises" on public.expertises;
create policy "staff_read_expertises"
    on public.expertises for select
    to authenticated
    using (public.is_editor() or public.is_reviewer());

drop policy if exists "editor_insert_expertises" on public.expertises;
create policy "editor_insert_expertises"
    on public.expertises for insert
    to authenticated
    with check (public.is_editor() and status = 'draft');

drop policy if exists "editor_update_draft_expertises" on public.expertises;
create policy "editor_update_draft_expertises"
    on public.expertises for update
    to authenticated
    using (public.has_role('editor') and status in ('draft', 'review'))
    with check (public.has_role('editor') and status in ('draft', 'review'));

drop policy if exists "admin_all_expertises" on public.expertises;
create policy "admin_all_expertises"
    on public.expertises for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "staff_read_projects" on public.projects;
create policy "staff_read_projects"
    on public.projects for select
    to authenticated
    using (public.is_editor() or public.is_reviewer());

drop policy if exists "editor_insert_projects" on public.projects;
create policy "editor_insert_projects"
    on public.projects for insert
    to authenticated
    with check (public.is_editor() and status = 'draft');

drop policy if exists "editor_update_draft_projects" on public.projects;
create policy "editor_update_draft_projects"
    on public.projects for update
    to authenticated
    using (public.has_role('editor') and status in ('draft', 'review'))
    with check (public.has_role('editor') and status in ('draft', 'review'));

drop policy if exists "admin_all_projects" on public.projects;
create policy "admin_all_projects"
    on public.projects for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Associations et galerie : lecture publique, écriture éditeur/admin
drop policy if exists "editor_write_project_expertises" on public.project_expertises;
create policy "editor_write_project_expertises"
    on public.project_expertises for all
    to authenticated
    using (public.is_editor())
    with check (public.is_editor());

drop policy if exists "editor_write_project_tags" on public.project_tags;
create policy "editor_write_project_tags"
    on public.project_tags for all
    to authenticated
    using (public.is_editor())
    with check (public.is_editor());

drop policy if exists "editor_write_project_media" on public.project_media;
create policy "editor_write_project_media"
    on public.project_media for all
    to authenticated
    using (public.is_editor())
    with check (public.is_editor());

-- ----------------------------------------------------------------
-- 6. Médias
-- ----------------------------------------------------------------
-- Visibilité publique : lisible par tous ; private/archive : staff uniquement
drop policy if exists "public_read_media" on public.media_assets;
create policy "public_read_media"
    on public.media_assets for select
    to anon, authenticated
    using (visibility = 'public');

drop policy if exists "staff_read_media" on public.media_assets;
create policy "staff_read_media"
    on public.media_assets for select
    to authenticated
    using (public.is_editor() or public.is_reviewer());

drop policy if exists "editor_insert_media" on public.media_assets;
create policy "editor_insert_media"
    on public.media_assets for insert
    to authenticated
    with check (public.is_editor());

drop policy if exists "editor_update_media" on public.media_assets;
create policy "editor_update_media"
    on public.media_assets for update
    to authenticated
    using (public.has_role('editor'))
    with check (public.has_role('editor'));

drop policy if exists "admin_all_media" on public.media_assets;
create policy "admin_all_media"
    on public.media_assets for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------
-- ----------------------------------------------------------------
drop policy if exists "admin_read_messages" on public.contact_messages;
create policy "admin_read_messages"
    on public.contact_messages for select
    to authenticated
    using (public.is_admin());

drop policy if exists "admin_update_messages" on public.contact_messages;
create policy "admin_update_messages"
    on public.contact_messages for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------------
-- 8. Journal d'audit : lecture admin, écriture service_role uniquement
-- ----------------------------------------------------------------
drop policy if exists "admin_read_audit" on public.audit_events;
create policy "admin_read_audit"
    on public.audit_events for select
    to authenticated
    using (public.is_admin());

-- ----------------------------------------------------------------
-- 9. Paramètres de site : lecture publique limitée aux clés is_public
-- ----------------------------------------------------------------
drop policy if exists "public_read_settings" on public.site_settings;
create policy "public_read_settings"
    on public.site_settings for select
    to anon, authenticated
    using (is_public = true);

drop policy if exists "admin_all_settings" on public.site_settings;
create policy "admin_all_settings"
    on public.site_settings for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());


