-- -------------------------------------------------------------------
-- 0021_new_user_profile.sql
-- Crée automatiquement le profil applicatif (public.profiles) d'un
-- utilisateur lors de son inscription Supabase Auth, et lui attribue le
-- rôle par défaut `readonly` (lecture des données non sensibles, aucune
-- écriture). Résout le blocage "un inscrit n'a jamais de profil → 403".
-- L'attribution admin/editor/reviewer reste une opération d'administration.
-- Idempotent : drop/create du trigger, insert protégé par ON CONFLICT.
-- -------------------------------------------------------------------

-- Fonction de trigger : crée le profil et affecte readonly par défaut.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, is_active)
    values (new.id, new.email, true)
    on conflict (id) do nothing;

    insert into public.role_assignments (profile_id, role_id)
    select nu.id, r.id
      from (select new.id as id) nu
      join public.roles r on r.code = 'readonly'
    on conflict (profile_id, role_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
    'Crée le profil applicatif et le rôle par défaut readonly à l''inscription';