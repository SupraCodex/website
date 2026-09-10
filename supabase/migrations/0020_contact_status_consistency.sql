-- -------------------------------------------------------------------
-- 0020_contact_status_consistency.sql
-- Aligne la contrainte de statut de contact_messages sur le contrat API
-- (`new|read|replied|closed`, voir MessageStatusInputSchema) qui divergeait
-- de la valeur DB initiale (`new|in_progress|done|archived`).
-- Migre les lignes existantes et remplace la contrainte de contrôle.
-- Idempotent : le remplacement de contrainte est protégé par DO block.
-- -------------------------------------------------------------------

-- 1) Migration des valeurs existantes vers le jeu API
update public.contact_messages
   set status = 'read'
 where status = 'in_progress';

update public.contact_messages
   set status = 'replied'
 where status = 'done';

update public.contact_messages
   set status = 'closed'
 where status = 'archived';

-- 2) Remplacement de la contrainte (idempotent)
do $$
begin
    if exists (
        select 1 from pg_constraint
        where conrelid = 'public.contact_messages'::regclass
          and conname = 'contact_messages_status_check'
    ) then
        alter table public.contact_messages
            drop constraint contact_messages_status_check;
    end if;
end$$;

alter table public.contact_messages
    add constraint contact_messages_status_check
    check (status in ('new', 'read', 'replied', 'closed'));