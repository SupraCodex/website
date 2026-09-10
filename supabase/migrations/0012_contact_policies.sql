-- 0012_contact_policies.sql
-- sans aucune politique -> refus total, y compris l'insertion publique du formulaire.
--   anon    : INSERT uniquement, honeypot vide, statut imposé 'new', pas de source_ip ni assignation.
drop policy if exists "anon_insert_contact" on public.contact_messages;
create policy "anon_insert_contact"
    on public.contact_messages for insert
    to anon
    with check (
        website = ''
        and status = 'new'
        and assigned_to is null
        and source_ip is null
    );

drop policy if exists "admin_read_contact" on public.contact_messages;
create policy "admin_read_contact"
    on public.contact_messages for select
    to authenticated
    using (public.is_admin());

drop policy if exists "admin_update_contact" on public.contact_messages;
create policy "admin_update_contact"
    on public.contact_messages for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

grant insert on public.contact_messages to anon;
grant select, update on public.contact_messages to authenticated;
