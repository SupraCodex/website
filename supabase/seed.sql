-- Données initiales du projet SupraCodex-Hack.
-- Ce seed ne contient aucun compte utilisateur, aucune donnée personnelle,
-- aucune référence client et aucun secret. Les contenus devront être validés
-- par le responsable éditorial avant publication en production.
-- CONTENT_MODE: PUBLIC_REVIEW_REQUIRED

insert into public.roles (code, label, description) values
    ('admin',    'Administrateur', 'Gère utilisateurs, paramètres, publications, messages et journaux'),
    ('editor',   'Éditeur',        'Crée et modifie les brouillons et contenus autorisés'),
    ('reviewer', 'Relecteur',      'Consulte les brouillons et commente sans publier'),
    ('readonly', 'Lecture seule',  'Consulte les données non sensibles')
on conflict (code) do nothing;

insert into public.tags (slug, label) values
    ('typescript', 'TypeScript'),
    ('postgresql', 'PostgreSQL'),
    ('cloud-devops', 'Cloud & DevOps'),
    ('cybersecurite', 'Cybersécurité'),
    ('owasp', 'OWASP'),
    ('mdn', 'MDN Web Docs'),
    ('cloud-native', 'Cloud native')
on conflict (slug) do nothing;

insert into public.categories (slug, label, content_type) values
    ('technique',  'Technique',  'article'),
    ('annonce',    'Actualités', 'announcement'),
    ('recrutement','Carrières', 'career')
on conflict (slug, content_type) do nothing;

insert into public.expertises (slug, title, summary, description, status) values
    ('developpement-web-mobile', 'Développement web et mobile', 'Conception de services web et mobiles robustes.', 'Architecture d’applications, API et interfaces adaptées aux usages du projet.', 'published'),
    ('cybersecurite-hacking-ethique', 'Cybersécurité applicative', 'Protection des applications, des données et des parcours sensibles.', 'Contrôles d’accès, validation des entrées, journalisation et réduction de la surface d’exposition.', 'published'),
    ('cloud-devops', 'Cloud et DevOps', 'Automatisation, déploiement contrôlé et observabilité.', 'Migrations, environnements séparés, sauvegardes et procédures de reprise.', 'published'),
    ('formation-technique', 'Formation technique', 'Transmission des pratiques de développement et de sécurité.', 'Documentation, accompagnement des équipes et mise en place de procédures reproductibles.', 'draft')
on conflict (slug) do nothing;

insert into public.projects (slug, title, summary, description, problem_statement, solution, outcome, confidentiality, featured, status, published_at) values
    ('supracodex-hub', 'SupraCodex-Hack', 'Plateforme éditoriale sécurisée basée sur Next.js et Supabase.', 'Backend structuré pour publier des contenus, gérer les rôles, protéger les données et administrer les médias.', 'Centraliser un workflow éditorial avec une séparation claire entre lecture publique et opérations administratives.', 'API versionnée, authentification Supabase, policies RLS, stockage de médias et tests automatisés.', 'Base technique prête pour la qualification staging et la validation métier.', 'public', true, 'published', now()),
    ('api-editoriale-securisee', 'API éditoriale sécurisée', 'Gestion de contenus avec workflow de brouillon, revue et publication.', 'Le service impose les transitions autorisées côté serveur et conserve les événements nécessaires à l’audit.', 'Empêcher la publication ou la modification de contenus par un rôle non habilité.', 'Matrice de permissions, vérification du rôle à chaque opération sensible et réponse API contractuelle.', 'Contrôle des accès et comportement reproductible dans les tests d’autorisation.', 'public', false, 'published', now()),
    ('pipeline-medias-publication', 'Pipeline médias et publication', 'Gestion contrôlée des médias associés aux contenus.', 'Le pipeline valide le type, la taille, les dimensions, le texte alternatif et la visibilité avant association.', 'Éviter la publication de fichiers non conformes ou insuffisamment documentés.', 'Validation serveur, buckets séparés et URL signées pour les ressources privées.', 'Médias publiables uniquement après contrôle des métadonnées et des droits.', 'public', false, 'published', now())
on conflict (slug) do nothing;

insert into public.project_expertises (project_id, expertise_id)
select p.id, e.id
from public.projects p
join public.expertises e on e.slug = 'developpement-web-mobile'
where p.slug = 'supracodex-hub'
on conflict (project_id, expertise_id) do nothing;

insert into public.project_expertises (project_id, expertise_id)
select p.id, e.id
from public.projects p
join public.expertises e on e.slug = 'cybersecurite-hacking-ethique'
where p.slug = 'api-editoriale-securisee'
on conflict (project_id, expertise_id) do nothing;

insert into public.project_expertises (project_id, expertise_id)
select p.id, e.id
from public.projects p
join public.expertises e on e.slug = 'cloud-devops'
where p.slug = 'pipeline-medias-publication'
on conflict (project_id, expertise_id) do nothing;

insert into public.project_tags (project_id, tag_id)
select p.id, t.id
from public.projects p
join public.tags t on t.slug in ('typescript', 'postgresql')
where p.slug = 'supracodex-hub'
on conflict (project_id, tag_id) do nothing;

insert into public.content_items (type, slug, title, excerpt, body, status, category_id, published_at) values
    ('article', 'securiser-un-formulaire-de-contact', 'Sécuriser un formulaire de contact', 'Principes de validation, limitation et journalisation d’une soumission publique.', '[]', 'published', (select id from public.categories where slug = 'technique'), now()),
    ('article', 'architecture-d-une-api-editoriale', 'Architecture d’une API éditoriale', 'Séparer le contrat public, les opérations administratives et les règles d’autorisation.', '[]', 'published', (select id from public.categories where slug = 'technique'), now()),
    ('article', 'api-security-top-10-reperes-owasp', 'API Security : repères OWASP pour une API éditoriale', 'Une lecture pratique des risques API à vérifier dans un backend qui sépare lecture publique et administration.',
      '[{"type":"p","text":"Le projet OWASP API Security Top 10 recense les risques fréquents des API et propose une base de discussion pour les développeurs et les équipes d’évaluation."},{"type":"h2","text":"Ce que nous vérifions ici"},{"type":"list","items":["Contrôler l’autorisation au niveau de l’objet et de la fonction.","Limiter la consommation des ressources et documenter les limites.","Maintenir un inventaire des routes et journaliser les opérations sensibles.","Valider les entrées et éviter de faire confiance aux propriétés envoyées par le client."]},{"type":"source","label":"OWASP API Security Top 10","url":"https://owasp.org/API-Security/","license":"CC BY-SA 4.0","accessedAt":"2026-09-10"}]', 'published', (select id from public.categories where slug = 'technique'), now()),
    ('article', 'securite-web-pratiques-mdn', 'Sécurité web : les contrôles de base à ne pas oublier', 'HTTPS, CSP, validation des entrées, contrôle des origines et gestion prudente des sessions.',
      '[{"type":"p","text":"MDN présente la sécurité web comme la protection des sites et de leurs utilisateurs contre les dommages provoqués par des tiers malveillants. La documentation insiste sur une défense en profondeur adaptée au contexte."},{"type":"h2","text":"Application au projet"},{"type":"list","items":["Servir les pages et ressources en HTTPS.","Définir une politique de sécurité du contenu lorsque le déploiement le permet.","Contrôler les requêtes cross-origin et valider les entrées côté serveur.","Protéger les sessions et limiter l’exposition des secrets et dépendances."]},{"type":"source","label":"MDN Web Docs — Security","url":"https://developer.mozilla.org/en-US/docs/Web/Security","license":"CC BY-SA 2.5","accessedAt":"2026-09-10"}]', 'published', (select id from public.categories where slug = 'technique'), now()),
    ('article', 'cloud-native-reperes-cncf', 'Cloud native : comprendre les repères CNCF', 'Un aperçu des projets cloud native et de leur place dans les chaînes de livraison, sécurité et observabilité.',
      '[{"type":"p","text":"La CNCF distingue notamment des projets arrivés à maturité et des projets en incubation. Sa page officielle recense leurs domaines, par exemple la livraison continue, la conformité, l’observabilité, les réseaux et le stockage cloud native."},{"type":"h2","text":"Pourquoi cela compte pour une API"},{"type":"p","text":"Un projet ne devient pas automatiquement cloud native parce qu’il utilise un fournisseur cloud. Les choix d’architecture, de déploiement, d’observabilité, de sauvegarde et de reprise doivent rester documentés et testables."},{"type":"source","label":"Cloud Native Computing Foundation — Graduated and Incubating Projects","url":"https://www.cncf.io/projects/","license":"Source publique CNCF","accessedAt":"2026-09-10"}]', 'published', (select id from public.categories where slug = 'technique'), now()),
    ('announcement', 'evolution-de-la-plateforme', 'Évolution de la plateforme', 'Les évolutions sont publiées après revue technique et validation métier.', '[]', 'published', (select id from public.categories where slug = 'annonce'), now())
on conflict (slug, type) do nothing;

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
    ('site_name', 'SupraCodex-Hack', true),
    ('editorial_sources', 'Les articles documentaires citent leurs sources publiques dans leur corps. Les informations sont à relire avant usage professionnel.', true),
    ('legal_notice_status', 'À compléter avec l’identité juridique, l’adresse et les coordonnées officielles de l’éditeur avant mise en production.', true),
    ('privacy_policy_status', 'À compléter avec la politique de confidentialité validée et les coordonnées du responsable de traitement avant mise en production.', true),
    ('media_contact_status', 'Aucune coordonnée média publique n’est publiée par défaut ; renseigner uniquement une adresse officielle validée.', true)
on conflict (key) do nothing;
