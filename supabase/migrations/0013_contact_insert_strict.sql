-- 0013_contact_insert_strict.sql
-- `public_insert_contact` (0008, with check true) autorisait n'importe quelle insertion
-- (honeypot rempli, statut arbitraire). Elle est remplacée par des contrôles stricts,
-- identiques à `anon_insert_contact` (0012). Lecture et mise à jour restent interdites
-- aux visiteurs ; la gestion passe par le serveur (service_role) et l'admin (0012).
drop policy if exists "public_insert_contact" on public.contact_messages;
create policy "public_insert_contact"
    on public.contact_messages for insert
    to anon, authenticated
    with check (
        website = ''
        and status = 'new'
        and assigned_to is null
        and source_ip is null
    );
