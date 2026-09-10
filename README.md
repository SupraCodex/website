# SupraCodex-Hack — Backend

![Version](https://img.shields.io/badge/version-1.0.0-1E40AF?style=flat-square)
![Statut](https://img.shields.io/badge/statut-production--ready-6B7280?style=flat-square)
![License](https://img.shields.io/badge/license-propri%C3%A9taire-4B5563?style=flat-square)

API éditoriale sécurisée pour le site vitrine **SupraCodex-Hack** : publication de contenus (articles, annonces, carrières, projets, expertises), gestion des médias, messagerie de contact et administration par rôles.

Construit avec **Next.js 16 (App Router) + TypeScript**, adossé à **Supabase** (PostgreSQL 17, Auth, Storage), exposé sous `/api/v1`.

---

## Table des matières

1. [Présentation](#pr%C3%A9sentation)
2. [Stack technique](#stack-technique)
3. [Architecture](#architecture)
4. [Prérequis](#pr%C3%A9requis)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Base de données](#base-de-donn%C3%A9es)
8. [Développement](#d%C3%A9veloppement)
9. [Tests](#tests)
10. [API](#api)
11. [Workflow éditorial](#workflow-%C3%A9ditorial)
12. [Médias](#m%C3%A9dias)
13. [Sécurité](#s%C3%A9curit%C3%A9)
14. [Déploiement](#d%C3%A9ploiement)
15. [Documentation complémentaire](#documentation-compl%C3%A9mentaire)
16. [Support et maintenance](#support-et-maintenance)

---

## Présentation

SupraCodex-Hack Backend est une API REST contrôlée et sécurisée qui sert de couche éditoriale et d'administration pour le site vitrine SupraCodex-Hack. Elle expose deux surfaces :

- **Une surface publique en lecture seule** : expertises, projets, articles d'actualité, offres d'emploi et configuration du site. Aucun contenu non publié n'est jamais exposé.
- **Une surface administrative authentifiée** : création, modification et workflow de publication des contenus, gestion des médias, suivi de la messagerie de contact, gestion des comptes et rôles, tokens de prévisualisation et journal d'audit.

Chaque requête est identifiée par un `request ID` corrélatif, validée par des schémas Zod, authentifiée via Supabase Auth, et autorisée selon une matrice rôle/transition. Les réponses suivent une enveloppe contractuelle unique et les erreurs sont systématiquement neutralisées (aucun détail d'implémentation n'est exposé au client).

Le projet est organisé autour de **22 migrations** versionnées (RLS, fonctions de rôle, politiques, moindre privilège) et d'un **seed idempotent** déclarant son mode de validation éditoriale (`PUBLIC_REVIEW_REQUIRED`).

---

## Stack technique

| Couche | Technologie | Version | Rôle |
|---|---|---|---|
| **Runtime** | Node.js | ≥ 22 | Exécution du serveur Next.js |
| **Framework web** | Next.js | 16.3 | App Router, route handlers dynamiques |
| **Typage** | TypeScript | 5.9 | Typage strict, `strict: true` |
| **Validation** | Zod | 3.24 | Schémas d'entrée (corps, query, slug, UUID) |
| **Base de données** | PostgreSQL | 17 | Stockage relationnel (Supabase) |
| **Auth** | Supabase Auth | — | JWT bearer, refresh tokens |
| **API DB** | PostgREST | — | Requêtes HTTP JSON vers PostgreSQL |
| **Storage** | Supabase Storage | — | Buckets médias (public/private/archive) |
| **Lint** | ESLint | 9.36 | `eslint-config-next` + `@typescript-eslint` |
| **Tests** | node:test | natif | Tests unitaires et d'intégration |
| **Scan secrets** | custom script | — | `scripts/quality-check.mjs` |

**Dépendances (runtime)** : `@supabase/supabase-js ^2.57.4`, `next ^16.3.4`, `react ^18.3.1`, `zod ^3.24.1`

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                          Client                              │
│        (frontend site vitrine ou tableau admin)              │
└──────────────┬────────────────────────┬────────────────────┘
               │                        │
   GET /api/v1/│    POST/GET/PATCH/     │  Authorization: Bearer <JWT>
               ▼                        ▼
      ┌──────────────────┐   ┌───────────────────────┐
      │ Route publique   │   │ Route admin           │
      │  /api/v1/[...]   │   │  /api/v1/admin/[...]  │
      └────────┬─────────┘   └─────────┬─────────────┘
               │                       │
               ▼                       ▼
      publique/router.ts      admin/router.ts
      ─ contenus publiés      ─ workflow & rôles
      ─ contact (POST)       ─ médias & signées URLs
      ─ site-config           ─ messagerie
               │               ─ utilisateurs & rôles
               │               ─ audit & dashboard
               │               ─ tokens de prévisualisation
               │               ─ médias (upload/métadonnées)
               │
               ▼
      ┌────────────────────────────────────────┐
      │            Service layer              │
      │  src/lib/api/                         │
      │   ├── public/      (router, service,   │
      │   │                  repository,        │
      │   │                  validate, mappers) │
      │   ├── admin/        (router, service,   │
      │   │                  repository,        │
      │   │                  workflow,         │
      │   │                  media-*,          │
      │   │                  validate, mappers) │
      │   ├── auth.ts       (RBAC, JWT verify)  │
      │   ├── envelope.ts   (contract v1)       │
      │   ├── errors.ts     (codes contractuels)│
      │   ├── respond.ts    (headers + réponses)│
      │   ├── validate.ts   (helpers Zod)       │
      │   ├── rate-limit.ts (in-memory, hash IP)│
      │   ├── logger.ts     (request logging)    │
      │   └── email/provider.ts (local adapter)│
      └────────────┬───────────────────────────┘
                   │ service_role (côté serveur)
                   ▼
          ┌────────────────────────────────────┐
          │         Supabase (cloud)            │
          │  PostgreSQL 17  │ Auth │ Storage │  │
          │  ─ RLS activé   │ JWT  │ 3 buckets │
          │  ─ 22 migrations │      │  public/  │
          │  ─ fonctions     │      │  private/ │
          │    SECURITY      │      │  archive/ │
          │    DEFINER       │      │           │
          └────────────────────────────────────┘
```

**Principes d'isolation :**

- Le **public** ne voit que les contenus au statut `published` et dont `published_at <= now()`.
- Les **brouillons**, la **messagerie** et les **journaux** sont invisibles côté client.
- Toute entrée est validée par **Zod** avant tout accès à la base.
- Les appels à la base s'effectuent avec la clé `service_role` côté serveur de confiance. Le **RLS** agit comme dernier rempart : les politiques restreignent explicitement chaque table.

---

## Prérequis

| Outil | Version minimale | Vérification |
|---|---|---|
| Node.js | 22 | `node --version` |
| npm | 10 | `npm --version` |
| Git | 2.30+ | `git --version` |
| cURL | — | pour les tests manuels |
| Supabase CLI *(optionnel)* | 2.x | `supabase --version` (dev local) |

**Comptes / accès :**

- Un projet Supabase hébergé (URL du projet, clés API) avec les migrations appliquées.
- Compte administrateur Supabase pour accéder au Dashboard (audit, SQL editor).
- Comptes utilisateurs de recette : `test-admin@supracodex.test`, `test-editor@supracodex.test`, `test-reviewer@supracodex.test`, `test-readonly@supracodex.test`.

---

## Installation

```bash
git clone https://github.com/spectrezones-spectre/supracodex-hack-site-vitrine-backend.git
cd supracodex-hack-site-vitrine-backend
npm ci
cp .env.example .env
```

Éditer `.env` puis démarrer :

```bash
npm run dev
```

Le serveur de développement écoute sur `http://localhost:3000`. Les routes API sont :

- Publiques : `http://localhost:3000/api/v1/*`
- Administratives : `http://localhost:3000/api/v1/admin/*`

---

## Configuration

Copier le modèle et renseigner chaque variable :

```bash
cp .env.example .env
```

| Variable | Visibilité | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | URL du projet Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Clé publique (exposée au frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur | Clé serveur — **jamais exposée au client** |
| `SUPABASE_DB_PASSWORD` | Serveur | Mot de passe PostgreSQL (migrations CLI) |
| `EMAIL_PROVIDER_API_KEY` | Serveur | Clé du fournisseur d'envoi (optionnel) |
| `EMAIL_FROM` | Serveur | Adresse expéditeur validée |
| `EMAIL_TO` | Server | Adresse de recette |
| `CONTACT_RATE_MAX_15MIN` | Serveur | Rate limit contact 15 min (optionnel, défaut 5) |
| `CONTACT_RATE_MAX_1H` | Server | Rate limit contact 1 h (optionnel, défaut 20) |

> **Règle d'or** : `.env` est dans `.gitignore`. La clé `service_role` ne doit jamais être commitée ni exposée au client. Le scan de secrets (`npm run quality:check`) vérifie cela automatiquement.

---

## Base de données

### Migrations

Les migrations sont versionnées de `0001` à `0022` dans `supabase/migrations/` et s'exécutent dans l'ordre numérique :

| N° | Thème | Description clé |
|---|---|---|
| `0001` | Extensions | `pgcrypto`, `pg_trgm` |
| `0002` | Profils & rôles | Enum `app_role`, tables `roles`, `profiles`, `role_assignments` |
| `0003` | Contenus | `content_items`, `categories`, `tags`, `content_tags`, `redirects` |
| `0004` | Projets & expertises | `expertises`, `projects`, associations |
| `0005` | Médias | `media_assets`, `project_media`, FK couverture |
| `0006` | Contact | `contact_messages` |
| `0007` | Audit | `audit_events` |
| `0008` | RLS de base | `public_read_content`, `public_insert_contact` |
| `0009` | Politiques rôle | Fonctions `is_admin`, `is_editor`, `is_reviewer` |
| `0010` | Grants lecture | `grant select` anon sur contenus publiés |
| `0011-0011b` | Grants contact/settings | Insertion anon contact, lecture settings |
| `0012` | Politiques contact strictes | Honeypot, statut imposé `new` |
| `0013` | Insert contact strict | Remplacement `with check (true)` → contrôles stricts |
| `0014` | Audit contact | `contact_audit_events` sans données personnelles |
| `0015` | Tokens preview | `preview_tokens` avec expiration |
| `0016` | Storage policies | Buckets `public`, `private`, `archive` |
| `0017` | Moindre privilège | Révoque `all` sur tables sensibles |
| `0018` | Preview tokens LP | `revoke all` anon/authenticated, `service_role` uniquement |
| `0019` | RLS durci | `force row level security` sur tables créées tardivement |
| `0020` | Cohérence statut contact | Alignement `new\|read\|replied\|closed` sur le contrat API |
| `0021` | Profil à l'inscription | Trigger crée profil + rôle `readonly` par défaut |
| `0022` | Enrichissement éditorial | Contenus/sources légales enrichis |

### Seed

`supabase/seed.sql` initialise les rôles, catégories, tags, expertises, projets, articles et paramètres de site. Il est **idempotent** (`ON CONFLICT DO NOTHING/UPDATE`) et ne contient **aucun compte utilisateur, secret ou donnée personnelle**. Il déclare son mode d'évaluation :

```sql
-- CONTENT_MODE: PUBLIC_REVIEW_REQUIRED
```

### Vérification

```bash
npm run migrations:check   # vérifie l'ordre, l'unicité et la cohérence des migrations + le marqueur de sécurité du seed
npm run rls:test           # exécute les tests RLS (`supabase/tests/rls_authorization_test.sql`)
```

---

## Développement

### Lancement local

```bash
npm run dev       # serveur de développement (hot reload)
npm run build     # build de production
npm run start     # exécution du build de production
```

### Scripts utiles

| Commande | Description |
|---|---|
| `npm run lint` | Analyse ESLint statique |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run quality:check` | Scan de secrets (pattern matching) |
| `npm run migrations:check` | Vérification l'ordre et cohérence des migrations + sécurité du seed |
| `npm run rls:test` | Test des politiques RLS |
| `npm run verify` | Lint + typecheck + tests + scan secrets + migrations (pipeline complet) |

### Recette manuelle (staging)

Des scripts de recette réelle sont fournis dans `scripts/` :

- `manual-phase-a.sh` — Tests des routes publiques (36 assertions)
- `manual-phase-b.sh` — Tests d'authentification (4 comptes)
- `manual-phase-c.sh` / `manual-phase-c-continue.sh` — Parcours administratif complet (70 vérifications)
- `real-public-smoke.sh` — Smoke test rapide

---

## Tests

| Niveau | Commande | Description |
|---|---|---|
| **Lint** | `npm run lint` | ESLint strict avec `@typescript-eslint` |
| **Type check** | `npm run typecheck` | TypeScript `strict`, `--noEmit` |
| **Secrets** | `npm run quality:check` | Scan pattern matching — jamais de secret committé |
| **Migrations** | `npm run migrations:check` | Séquence numérique continue, seed safety |
| **Unitaires** | `npm test` | `node --experimental-strip-types --test tests/api/*.test.ts` |
| **Intégration** | `npm test` | Appels réels contre staging (skippés si `.env` absent) |
| **RLS** | `npm run rls:test` | `supabase/tests/rls_authorization_test.sql` |

**Suites de tests** (`tests/api/`):

| Fichier | Focus |
|---|---|
| `envelope.test.ts` | Structure et validation des enveloppes API |
| `errors.test.ts` | Codes d'erreur contractuels |
| `validate.test.ts` | Helpers de validation (UUID, slug, pagination) |
| `rate-limit.test.ts` | Logique de limitation et hachage d'identité |
| `respond.test.ts` | En-têtes de sécurité et réponses |
| `contact.test.ts` | Validation formulaire + honeypot |
| `contact.integration.test.ts` | Insertion réelle + rate limit (staging) |
| `public-api.test.ts` | Routes publiques (expertises, projets, articles, careers) |
| `auth.contract.test.ts` | Authentification JWT + rôles |
| `admin.test.ts` | Gestion des rôles et comptes |
| `admin.contract.test.ts` | Contrat de l'API admin |
| `media-validate.test.ts` | Validation type/taille/alt-text médias |
| `media.integration.test.ts` | Upload et URL signée (staging) |
| `users.test.ts` | Matrice des permissions utilisateurs |

---

## API

### Enveloppe contractuelle

Toutes les réponses suivent l'enveloppe unique `{ data, meta, error }` (version de contrat `1`) :

```jsonc
// Succès
{
  "data": { ... },
  "meta": { "requestId": "uuid", "contractVersion": "1", "page": 1, "limit": 10, "total": 42 }
}

// Erreur
{
  "error": {
    "code": "VALIDATION_ERROR",   // code machine
    "message": "Requête invalide.", // message générique
    "details": [{ "field": "email", "issue": "adresse invalide" }]  // optionnel
  },
  "meta": { "requestId": "uuid", "contractVersion": "1" }
}
```

- `X-Request-Id` : en-tête de corrélation sur todas les réponses.
- Cache : `no-store` (admin/contact), `public, max-age=60, stale-while-revalidate=300` (contenus publiés).

### Codes HTTP

| Statut | Code | Signification |
|---|---|---|
| 200 | OK | Succès lecture / mise à jour |
| 201 | Created | Création réussie |
| 202 | Accepted | Accepté (contact) |
| 204 | No Content | Suppression réussie |
| 400 | Bad Request | Requête mal formée |
| 401 | UNAUTHENTICATED | JWT manquant ou invalide |
| 403 | FORBIDDEN | Rôle insuffisant |
| 404 | NOT_FOUND | Ressource introuvable |
| 409 | CONFLICT | Transition interdite / conflit d'état |
| 422 | VALIDATION_ERROR | Entrée invalide (détails fournis) |
| 429 | RATE_LIMITED | Trop de requêtes |
| 500 | INTERNAL_ERROR | Erreur interne (neutre) |

### Routes publiques (lecture seule)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/expertises` | Liste paginée des expertises publiées |
| GET | `/api/v1/expertises/{slug}` | Détail d'une expertise publiée |
| GET | `/api/v1/projects` | Liste paginée des projets (`?featured=true&expertise={slug}`) |
| GET | `/api/v1/projects/{slug}` | Détail d'un projet publié |
| GET | `/api/v1/articles` | Liste paginée des articles (`?category={slug}&q={search}`) |
| GET | `/api/v1/articles/{slug}` | Détail d'un article publié |
| GET | `/api/v1/announcements` | Liste des annonces publiées |
| GET | `/api/v1/announcements/{slug}` | Détail d'une annonce |
| GET | `/api/v1/careers` | Liste des offres d'emploi publiées |
| GET | `/api/v1/careers/{slug}` | Détail d'une offre publiée |
| GET | `/api/v1/site-config/public` | Configuration publique du site |
| POST | `/api/v1/contact-messages` | Soumission du formulaire de contact |

### Routes administratives (JWT Bearer requis)

| Méthode | Route | Rôle min | Description |
|---|---|---|---|
| GET | `/api/v1/admin/me` | tous | Session courante |
| POST | `/api/v1/admin/session/refresh` | — | Rafraîchissement du jeton |
| GET | `/api/v1/admin/dashboard` | admin/editor | Statistiques du tableau de bord |
| GET | `/api/v1/admin/users` | admin | Liste des comptes |
| POST | `/api/v1/admin/users/{id}/roles` | admin | Attribuer un rôle |
| DELETE | `/api/v1/admin/users/{id}/roles/{code}` | admin | Retirer un rôle |
| GET | `/api/v1/admin/articles` | admin/editor | Liste des contenus |
| POST | `/api/v1/admin/articles` | admin/editor | Créer un contenu (brouillon) |
| GET | `/api/v1/admin/articles/{id}` | admin/editor | Détail d'un contenu |
| PATCH | `/api/v1/admin/articles/{id}` | admin/editor | Modifier (brouillon/review) |
| DELETE | `/api/v1/admin/articles/{id}` | admin | Supprimer |
| POST | `/api/v1/admin/articles/{id}/{action}` | selon transition | `submit\|publish\|archive\|submit\|unarchive\|reject` |
| GET | `/api/v1/admin/messages` | admin | Liste des messages |
| PATCH | `/api/v1/admin/messages/{id}` | admin | Mettre à jour le statut |
| POST | `/api/v1/admin/articles/{id}/preview` | admin/editor/reviewer | Créer un token de prévisualisation |
| GET | `/api/v1/admin/preview/{token}` | — (public) | Résoudre un token de prévisualisation |
| GET | `/api/v1/admin/media` | admin/editor | Liste des médias |
| POST | `/api/v1/admin/media` | admin/editor | Upload d'un média |
| GET | `/api/v1/admin/media/{id}` | admin/editor | Métadonnées d'un média |
| PATCH | `/api/v1/admin/media/{id}` | admin/editor | Mettre à jour les métadonnées |
| DELETE | `/api/v1/admin/media/{id}` | admin/editor | Supprimer un média |
| POST | `/api/v1/admin/media/{id}/signed-url` | admin/editor | URL signée temporaire |
| GET | `/api/v1/admin/media/{id}/derivatives` | admin/editor | Médias dérivés |
| GET | `/api/v1/admin/media/orphans` | admin/editor | Rapport de médias orphelins |
| GET | `/api/v1/admin/audit-events` | admin | Journal d'audit |

---

## Workflow éditorial

### Rôles

| Rôle | Description | Accès admin |
|---|---|---|
| `admin` | Administrateur — accès plein | Toutes les opérations |
| `editor` | Éditeur — crée et modifie contenus | Création, modification brouillons/review, preview |
| `reviewer` | Relecteur — relit sans publier | Lecture brouillons, preview, rejet |
| `readonly` | Lecture seule | Lecture seule des données non sensibles |

> À l'inscription, chaque utilisateur reçoit automatiquement le rôle `readonly` (migration `0021`). Les élevations se font via l'API admin uniquement.

### Transitions de statut

```
draft ──────submit──────► review
  │                        │
  │     submit           │ publish (admin)
  │     reject (admin/   │   │
  │     reviewer)         ▼   │
  └──────────◄── reject ─── published
                           │
                           │ archive (admin)
                           ▼
                          archived
                           │
                           │ unarchive (admin)
                           ▼
                          draft
```

| Depuis | Action | Vers | Rôle requis |
|---|---|---|---|
| `draft` | `submit` | `review` | admin, editor |
| `draft` | `delete` | — | admin |
| `review` | `publish` | `published` | admin |
| `review` | `reject` | `draft` | admin, reviewer |
| `published` | `publish` | `published` | admin (idempotent) |
| `published` | `archive` | `archived` | admin |
| `archived` | `archive` | `archived` | admin (idempotent) |
| `archived` | `unarchive` | `draft` | admin |

**Règles de publication** (vérifiées avant `publish`) : titre ≥ 3 caractères, résumé ≥ 10 caractères, corps non vide, image de couverture requise.

---

## Médias

### Buckets Storage

| Bucket | Visibilité | Accès |
|---|---|---|
| `public` | Lecture publique | URL directe |
| `private` | Accès serveur uniquement | URL signée temporaire |
| `archive` | Accès serveur uniquement | URL signée temporaire |

### Validation (serveur)

| Critère | Exigence |
|---|---|
| **Type MIME** | `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/svg+xml`, `application/pdf` |
| **Extension** | Cohérence MIME/extension (ex: `.png` → `image/png`) |
| **Taille** | ≤ 10 Mo |
| **Texte alternatif** | Requis (ou `isDecorative: true`) |
| **Nom de fichier** | ≤ 255 caractères, pas de `../`, pas de chemin |

### URL signées

Les ressources `private` et `archive` ne sont jamais servies directement. Une URL signée est générée par `POST /api/v1/admin/media/{id}/signed-url` (durée configurable, défaut 3600 secondes).

### Traitement

- Détection des médias orphelins (`GET /api/v1/admin/media/orphans`)
- Médias dérivés (`GET /api/v1/admin/media/{id}/derivatives`)
- Suppression contrôlée (`DELETE`, jamais automatique)

---

## Sécurité

### RLS (Row Level Security)

- **RLS activé et forcé** sur toutes les tables exposées (migration `0008` + `0019`).
- Les fonctions `is_admin()`, `is_editor()`, `is_reviewer()`, `has_role()` sont `SECURITY DEFINER` mais **révoquées de `PUBLIC`** et accordées uniquement à `authenticated` (migration `0019`).
- **Moindre privilège** : `grant all` sur tables sensibles révoqué du rôle `authenticated`, remplacé par des grants explicites (migration `0017`).
- Les tables sensibles (`contact_audit_events`, `preview_tokens`) sont en accès **exclusif `service_role`** (migrations `0018`, `0019`).

### Rate limiting

- Appliqué sur le formulaire de contact : **5 requêtes / 15 min** et **20 / heure** par empreinte IP.
- L'empreinte IP est **hachée** (FNV-1a, non réversible) — jamais stockée en clair.
- Configurable via `CONTACT_RATE_MAX_15MIN` / `CONTACT_RATE_MAX_1H` (borne max 500 et 2000).
- Les dépassements renvoient `429 RATE_LIMITED`.

### Honeypot

- Champ `website` dans le formulaire de contact : s'il est rempli, la réponse est **identique** à une soumission acceptée (`202`). L'abuseur ne peut pas distinguer un filtrage d'une acceptation.

### Anti-fuite d'informations

- Les erreurs sont **toujours génériques** : aucun détail d'implémentation, de stack trace ou de donnée utilisateur n'est exposé.
- En-têtes de sécurité systématiques : `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: DENY`.
- `404` identique pour les slugs absents, brouillons, archivés ou non publiés — **aucune divulgation**.

### Scan de secrets

`npm run quality:check` inspecte tous les fichiers (hors `.git`, `node_modules`, `.next`, `.env`) à la recherche de clés privées, tokens API et clés Supabase non masquées. Le seed est également vérifié pour contenir le marqueur `CONTENT_MODE`.

---

## Déploiement

### Checklist pré-déploiement

- [ ] `npm run verify` passe localement (lint + typecheck + tests + scan + migrations)
- [ ] `npm run build` réussit sans erreur
- [ ] `npm run rls:test` passe
- [ ] Le fichier `.env` est correctement renseigné (et non commité)
- [ ] La clé `service_role` est active (non révoquée) dans le projet Supabase
- [ ] Les migrations `0001`–`0022` sont appliquées sur l'environnement de cible
- [ ] Le seed est appliqué et les contenus sont en `draft`/`review` (examen préalable)
- [ ] Les paramètres de site sensibles (`legal_notice_status`, `privacy_policy_status`, etc.) sont renseignés avant mise en production

### Procédure de déploiement

1. **Build** : `npm run build`
2. **Appliquer les migrations** : `supabase db push` (ou via le Dashboard Supabase → SQL Editor)
3. **Seed** : `supabase db reset` (local) ou exécuter `supabase/seed.sql` sur staging
4. **Configurer les secrets** : renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` dans l'environnement de déploiement
5. **Démarrer** : `npm start` (ou via le platform de hosting choisi)
6. **Vérifier** : exécuter `scripts/real-public-smoke.sh` contre l'environnement déployé

### Rollback

- Les migrations sont **additives et idempotentes** — chaque fichier utilise `IF NOT EXISTS` / `DROP IF EXISTS`.
- En cas de régression, révoquer la clé `service_role` compromise et la régénérer depuis le Dashboard Supabase → Settings → API.
- Le build précédent peut être redéployé en inversant le déploiement.

---

## Documentation complémentaire

| Ressource | Chemin | Description |
|---|---|---|
| Guide de recette manuel | `scripts/manual-phase-a.sh` / `manual-phase-c.sh` | Tests HTTP complets contre staging |
| Matrice de permissions | `docs/permissions-matrix.md` | Matrice rôle × action (référencée par `auth.ts:87`) |
| Smoke test | `scripts/real-public-smoke.sh` | Vérifications rapides routes publiques |
| Rapport de recette | `REAL-TEST-REPORT.md` | Rapport détaillé des tests réels staging (10 sept. 2026) |
| Tests RLS SQL | `supabase/tests/rls_authorization_test.sql` | Scénarios d'autorisation RLS |
| Template PR | `.github/pull_request_template.md` | Processus de revue pull request |
| Cahier des charges | `project-materials/` | Spécifications métier |

---

## Support et maintenance

- **Dépôt** : [spectrezones-spectre/supracodex-hack-site-vitrine-backend](https://github.com/spectrezones-spectre/supracodex-hack-site-vitrine-backend)
- **Branche principale** : `master`
- **Issues** : via GitHub Issues (PR template fourni)
- **Contributions** : fork → branche → PR → revue (voir `.github/pull_request_template.md`)
- **CI attendue** : lint, typecheck, tests unitaires, scan secrets, vérification migrations
- **Maintenance** : revue des migrations et politiques RLS à chaque changement de schéma. Le seed est revu à chaque évolution éditorielle avant publication.
