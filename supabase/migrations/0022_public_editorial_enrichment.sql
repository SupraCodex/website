-- 0022_public_editorial_enrichment.sql
-- Enrichissement éditorial public à partir de sources officielles.
-- Les textes sont des synthèses originales ; chaque article conserve sa source publique.

insert into public.tags (slug, label) values
    ('owasp', 'OWASP'),
    ('mdn', 'MDN Web Docs'),
    ('cloud-native', 'Cloud native')
on conflict (slug) do nothing;

insert into public.content_items (type, slug, title, excerpt, body, status, category_id, published_at)
values
    ('article', 'api-security-top-10-reperes-owasp', 'API Security : repères OWASP pour une API éditoriale', 'Une lecture pratique des risques API à vérifier dans un backend qui sépare lecture publique et administration.', '[{"type":"p","text":"Le projet OWASP API Security Top 10 recense les risques fréquents des API et propose une base de discussion pour les développeurs et les équipes d’évaluation."},{"type":"h2","text":"Ce que nous vérifions ici"},{"type":"list","items":["Contrôler l’autorisation au niveau de l’objet et de la fonction.","Limiter la consommation des ressources et documenter les limites.","Maintenir un inventaire des routes et journaliser les opérations sensibles.","Valider les entrées et éviter de faire confiance aux propriétés envoyées par le client."]},{"type":"source","label":"OWASP API Security Top 10","url":"https://owasp.org/API-Security/","license":"CC BY-SA 4.0","accessedAt":"2026-09-10"}]', 'published', (select id from public.categories where slug = 'technique' and content_type = 'article'), now()),
    ('article', 'securite-web-pratiques-mdn', 'Sécurité web : les contrôles de base à ne pas oublier', 'HTTPS, CSP, validation des entrées, contrôle des origines et gestion prudente des sessions.', '[{"type":"p","text":"MDN présente la sécurité web comme la protection des sites et de leurs utilisateurs contre les dommages provoqués par des tiers malveillants. La documentation insiste sur une défense en profondeur adaptée au contexte."},{"type":"h2","text":"Application au projet"},{"type":"list","items":["Servir les pages et ressources en HTTPS.","Définir une politique de sécurité du contenu lorsque le déploiement le permet.","Contrôler les requêtes cross-origin et valider les entrées côté serveur.","Protéger les sessions et limiter l’exposition des secrets et dépendances."]},{"type":"source","label":"MDN Web Docs — Security","url":"https://developer.mozilla.org/en-US/docs/Web/Security","license":"CC BY-SA 2.5","accessedAt":"2026-09-10"}]', 'published', (select id from public.categories where slug = 'technique' and content_type = 'article'), now()),
    ('article', 'cloud-native-reperes-cncf', 'Cloud native : comprendre les repères CNCF', 'Un aperçu des projets cloud native et de leur place dans les chaînes de livraison, sécurité et observabilité.', '[{"type":"p","text":"La CNCF distingue notamment des projets arrivés à maturité et des projets en incubation. Sa page officielle recense leurs domaines, par exemple la livraison continue, la conformité, l’observabilité, les réseaux et le stockage cloud native."},{"type":"h2","text":"Pourquoi cela compte pour une API"},{"type":"p","text":"Un projet ne devient pas automatiquement cloud native parce qu’il utilise un fournisseur cloud. Les choix d’architecture, de déploiement, d’observabilité, de sauvegarde et de reprise doivent rester documentés et testables."},{"type":"source","label":"Cloud Native Computing Foundation — Graduated and Incubating Projects","url":"https://www.cncf.io/projects/","license":"Source publique CNCF","accessedAt":"2026-09-10"}]', 'published', (select id from public.categories where slug = 'technique' and content_type = 'article'), now())
on conflict (slug, type) do update
set title = excluded.title,
    excerpt = excluded.excerpt,
    body = case when public.content_items.body = '[]'::jsonb then excluded.body else public.content_items.body end,
    status = 'published',
    published_at = coalesce(public.content_items.published_at, excluded.published_at);

insert into public.content_tags (content_id, tag_id)
select c.id, t.id
from public.content_items c
join public.tags t on t.slug in ('owasp', 'cybersecurite')
where c.slug = 'api-security-top-10-reperes-owasp' and c.type = 'article'
on conflict (content_id, tag_id) do nothing;

insert into public.content_tags (content_id, tag_id)
select c.id, t.id
from public.content_items c
join public.tags t on t.slug = 'mdn'
where c.slug = 'securite-web-pratiques-mdn' and c.type = 'article'
on conflict (content_id, tag_id) do nothing;

insert into public.content_tags (content_id, tag_id)
select c.id, t.id
from public.content_items c
join public.tags t on t.slug in ('cloud-native', 'cloud-devops')
where c.slug = 'cloud-native-reperes-cncf' and c.type = 'article'
on conflict (content_id, tag_id) do nothing;

insert into public.site_settings (key, value, is_public) values
    ('editorial_sources', 'Les articles documentaires citent leurs sources publiques dans leur corps. Les informations sont à relire avant usage professionnel.', true),
    ('legal_notice_status', 'À compléter avec l’identité juridique, l’adresse et les coordonnées officielles de l’éditeur avant mise en production.', true),
    ('privacy_policy_status', 'À compléter avec la politique de confidentialité validée et les coordonnées du responsable de traitement avant mise en production.', true),
    ('media_contact_status', 'Aucune coordonnée média publique n’est publiée par défaut ; renseigner uniquement une adresse officielle validée.', true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;
