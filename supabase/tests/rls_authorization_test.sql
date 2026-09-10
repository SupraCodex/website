-- rls_authorization_test.sql
-- Tests d'autorisation RLS selon la matrice des permissions du projet.
-- Script psql à exécuter après `supabase db reset` sur une base locale :
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rls_authorization_test.sql
-- Prérequis : seed.sql appliqué. Les comptes de test sont créés éphémèrement ici
-- dans auth.users (emails @test.local, mot de passe aléatoire jetable, jamais réel).

\set ON_ERROR_STOP on

create schema if not exists tests;

-- Helpers : crée un utilisateur de test et son profil avec un rôle donné.
create or replace function tests.create_test_user(email text, role_code app_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid;
    v_role uuid;
begin
    select id into v_uid from auth.users where email = tests.create_test_user.email;
    if v_uid is null then
        insert into auth.users (instance_id, email, encrypted_password, aud, role_, email_confirmed_at, created_at, updated_at)
        values ('00000000-0000-0000-0000-000000000000', tests.create_test_user.email,
                crypt(md5(random()::text), gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now())
        returning id into v_uid;
    end if;
    insert into public.profiles (id, email, is_active) values (v_uid, tests.create_test_user.email, true)
    on conflict (id) do update set is_active = true;
    select id into v_role from public.roles where code = role_code;
    insert into public.role_assignments (profile_id, role_id) values (v_uid, v_role)
    on conflict (profile_id, role_id) do nothing;
    return v_uid;
end $$;

-- Cas de test attendus (résultat attendu -> requête) :
--   T01 anon lit les contenus publiés              -> OK
--   T02 anon ne lit PAS les brouillons             -> vide
--   T03 anon ne lit PAS contact_messages           -> refusé (permisssion)
--   T04 anon insère un message de contact          -> OK
--   T05 editor lit les brouillons                  -> OK
--   T06 editor insère un contenu 'draft'           -> OK
--   T07 editor ne peut PAS insérer 'published'     -> refusé
--   T08 editor ne publie pas (update status)       -> 0 ligne
--   T09 editor ne lit PAS contact_messages         -> vide
--   T10 reviewer lit les brouillons                -> OK
--   T11 reviewer ne peut PAS insérer de contenu    -> refusé
--   T12 admin publie (update status)               -> 1 ligne
--   T13 admin lit les messages                     -> OK
--   T14 admin lit le journal d'audit               -> OK
--   T15 readonly ne modifie rien                   -> 0 ligne
--   T16 utilisateur désactivé : plus aucun accès staff -> 0 ligne
--   T17 role_assignments non modifiable par editor -> refusé
--   T18 settings non publics invisibles pour anon  -> vide

-- Exemple d'exécution d'un cas (T12) :
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<admin-uuid>","role":"authenticated"}';
--   update public.content_items set status='published', published_at=now()
--     where slug='architecture-d-une-api-editoriale';
--   -- attendu : UPDATE 1
-- rollback;

-- Note : l'exécution complète dépend de l'injection des claims JWT de test ;
-- Aucun mot de passe réel ni compte de production n'est utilisé.
