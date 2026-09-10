-- 0001_extensions.sql
-- Idempotent : chaque extension est activée une seule fois si absente.
-- Ne contient aucun secret ni donnée réelle.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";