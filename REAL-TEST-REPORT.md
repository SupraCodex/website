# Rapport de recette réelle — SupraCodex-Hack API

**Date :** 10 septembre 2026
**Dépôt :** `spectrezones-spectre/supracodex-hack-site-vitrine-backend`  
**Branche :** `feat/supracodex-backend`
**Staging :** `https://dzsfqrxsjbfpmyhknvrb.supabase.co`
**Méthode :** commandes réelles `npm`, `curl`, Supabase Auth/PostgREST et API HTTP locale. Aucun mock n’a été utilisé pour les résultats réseau.

## Conclusion

La recette HTTP publique, l’authentification des quatre comptes staging et l’ensemble du parcours administratif C ont été exécutés réellement. Une correction du script de recette C a été apportée et poussée dans le commit `97f479c`.

Un blocage de configuration staging reste ouvert : la valeur `SUPABASE_SERVICE_ROLE_KEY` fournie dans la demande est rejetée par les endpoints PostgREST et Auth Admin avec `Invalid API key`. Les tests qui nécessitent cette clé ne sont donc pas déclarés passants. La clé anon réelle du projet a été récupérée via l’intégration Supabase et utilisée pour les tests anon/Auth.

## Correction appliquée et poussée

| Fichier | Correction | Commit |
|---|---|---|
| `scripts/manual-phase-c-continue.sh` | Remplacement des slugs fixes `recette-reprise-v2` et `recette-reprise-v3` par des slugs dérivés de l’UUID de l’article, afin d’éviter les collisions lors de rejouements sur le staging | `97f479c` |

Cette correction a été vérifiée par `bash -n` puis par la reprise réelle de C19 à C70.

## Contrôles locaux

| Commande | Résultat |
|---|---|
| `npm ci` | Réussi |
| `npm run lint` | Réussi avant la dernière correction de script |
| `npm run typecheck` | Réussi avant la dernière correction de script |
| `npm run security:scan` | Réussi, scan de secrets sans alerte |
| `npm run migrations:check` | Réussi, migrations ordonnées |
| `npm test` avec configuration staging | 94 tests : 82 réussis, 4 échecs liés à la clé service, 8 ignorés |
| `git diff --check` | Aucun problème constaté avant clôture |

Les quatre échecs réseau sont cohérents avec la clé service invalide : deux contrats PostgREST service-role et deux tests d’intégration contact qui doivent lire/insérer via la clé service.

## Partie A — routes publiques réelles

Le parcours `scripts/manual-phase-a.sh` a passé **36 assertions** ; le cas carrière détaillé a été correctement marqué `SKIP` car le staging ne contient aucune carrière.

| Scénario | Résultat |
|---|---:|
| Expertises, pagination, filtre tag | 200 |
| Page/limite/tag invalides | 422 |
| Expertise publiée | 200 |
| Brouillon et ressource absente | 404 |
| Projets, filtres et détail | 200 |
| Articles, catégories, recherche et détail | 200 |
| Configuration publique | 200 |
| Routes inconnue et méthodes publiques interdites | 404 |
| Contact invalide | 422 |
| Honeypot | 202, réponse neutre |

Le rate-limit a été exécuté par `curl` avec la même valeur `X-Forwarded-For` : requêtes 1 à 5 en `202`, requête 6 en `429 RATE_LIMITED`.

## Partie B — authentification réelle

Les quatre comptes du guide ont été connectés directement via `POST /auth/v1/token?grant_type=password` avec la clé anon réelle. Les quatre réponses ont fourni un `access_token`.

| Compte | `/api/v1/admin/me` | Dashboard |
|---|---|---:|
| `test-admin@supracodex.test` | `admin` | 200 |
| `test-editor@supracodex.test` | `editor` | 200 |
| `test-reviewer@supracodex.test` | `reviewer` | 403 |
| `test-readonly@supracodex.test` | `readonly` | 403 |

Un jeton invalide a produit `401 UNAUTHENTICATED`.

## Partie C — parcours administratif réel

La reprise `scripts/manual-phase-c-continue.sh` a passé **C19 à C70**, soit 52 vérifications réelles :

- modification de brouillon et refus reviewer ;
- transitions submit/reject/publish/archive/unarchive ;
- refus `409` de publication sans couverture et de modification d’un publié ;
- prévisualisation et résolution publique du token ;
- liste, upload, validation, mise à jour, URL signée, dérivés, orphelins et suppression des médias ;
- messages, audit et pagination ;
- liste des utilisateurs, attribution/retrait de rôles et verrouillage de l’auto-retrait admin.

Les données d’article et de média créées par ce parcours ont été supprimées par les étapes de nettoyage du script.

## Vérification explicite de la clé service

La valeur fournie pour `SUPABASE_SERVICE_ROLE_KEY` a été utilisée par `curl` sur les endpoints réels. Le résultat observé est `401` avec `Invalid API key` sur PostgREST/Auth Admin. En conséquence :

1. le backend peut authentifier les comptes avec la clé anon réelle ;
2. les parcours HTTP déjà exécutés avec les jetons utilisateurs sont réels et passants ;
3. les tests nécessitant un accès service direct ne peuvent pas être déclarés verts tant qu’une clé `service_role` active n’est pas fournie ou régénérée dans Supabase.

Aucune modification de la base, aucun contournement et aucun mock n’a été utilisé pour masquer ce problème.

## Action nécessaire côté staging

Régénérer une clé `service_role` active dans Supabase, mettre à jour le secret d’exécution local/CI, puis relancer :

```bash
npm test
npm run rls:test
```

Après remplacement de la clé, les vérifications contact d’intégration et RLS devront être rejouées ; elles n’ont pas été artificiellement validées dans ce rapport.

## Références

- Guide joint : `/home/ubuntu/upload/manual-testing-guide.md`
- Smoke réel : `scripts/real-public-smoke.sh`
- Partie A réelle : `scripts/manual-phase-a.sh`
- Partie C réelle : `scripts/manual-phase-c.sh` et `scripts/manual-phase-c-continue.sh`

## Enrichissement éditorial du 10 septembre 2026

Une recherche web ciblée a été menée sur trois sources officielles : [OWASP API Security](https://owasp.org/API-Security/), [MDN Web Docs — Security](https://developer.mozilla.org/en-US/docs/Web/Security) et [CNCF — Graduated and Incubating Projects](https://www.cncf.io/projects/). Les contenus ajoutés sont des synthèses originales, avec une référence, une licence ou indication d’usage et une date de consultation dans chaque corps d’article.

Trois articles publics ont été ajoutés : `api-security-top-10-reperes-owasp`, `securite-web-pratiques-mdn` et `cloud-native-reperes-cncf`. Quatre paramètres publics ont également été ajoutés pour rendre explicite l’état à compléter des mentions légales, de la politique de confidentialité et du contact média. Aucune personne morale, adresse, téléphone, e-mail ou pseudo-coordonnée n’a été inventé.

La migration `0022_public_editorial_enrichment.sql` a été appliquée au projet Supabase staging avec succès. Les routes réelles ont ensuite confirmé : `GET /api/v1/articles` en `200` avec cinq articles, chacun des trois nouveaux slugs en `200` avec quatre blocs de contenu, et `GET /api/v1/site-config/public` en `200`. Le seed local a été enrichi de manière idempotente en parallèle.
