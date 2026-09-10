-- 0016_storage_policies.sql
-- Buckets : public (lecture publique), private (brouillons/originaux, accès serveur),
-- archive (accès serveur). Les opérations d'écriture passent par service_role (côté serveur).
-- Les originaux ne sont jamais supprimés automatiquement.

-- Lecture publique sur le bucket public
create policy "public_read_public"
on storage.objects for select
to public
using ( bucket_id = 'public' );

-- Accès serveur complet (service_role) — le serveur valide les droits métier en amont
create policy "service_all_public"
on storage.objects for all
to service_role
using ( bucket_id = 'public' )
with check ( bucket_id = 'public' );

create policy "service_all_private"
on storage.objects for all
to service_role
using ( bucket_id = 'private' )
with check ( bucket_id = 'private' );

create policy "service_all_archive"
on storage.objects for all
to service_role
using ( bucket_id = 'archive' )
with check ( bucket_id = 'archive' );

-- Lecture privée : uniquement via URL signées (pas de lecture directe anon/authenticated)
-- Les URL signées sont générées par le serveur (createSignedUrl)
