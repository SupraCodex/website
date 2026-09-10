
import { ApiError } from "./errors.ts";

export const PAGE_DEFAULT = 1;
export const LIMIT_DEFAULT = 10;
export const LIMIT_MAX = 50;

function fail(field: string, issue: string): never {
  throw ApiError.validation("Requête invalide.", [{ field, issue }]);
}

export function vString(value: unknown, field: string, opts: { min?: number; max?: number; required?: boolean } = { max: 255 }): string {
  if (value === undefined || value === null || value === "") {
    if (opts.required) fail(field, "champ requis");
    return "";
  }
  if (typeof value !== "string") fail(field, "doit être une chaîne");
  const s = value.trim();
  if (opts.required && !s) fail(field, "champ requis");
  const max = opts.max ?? 255;
  if (s.length > max) fail(field, `longueur maximale ${max}`);
  if (opts.min !== undefined && s.length < opts.min) fail(field, `longueur minimale ${opts.min}`);
  return s;
}

export function vEmail(value: unknown, field: string, required = true): string {
  const s = vString(value, field, { max: 320, required });
  if (!s) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.includes("..")) fail(field, "adresse invalide");
  return s.toLowerCase();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function vUuid(value: unknown, field: string, required = true): string {
  const s = vString(value, field, { max: 36, required });
  if (!s) return "";
  if (!UUID_RE.test(s)) fail(field, "identifiant invalide");
  return s;
}

export function vEnum<T extends string>(value: unknown, field: string, allowed: readonly T[], required = true): T {
  const s = vString(value, field, { max: 64, required });
  if (!s) return undefined as unknown as T;
  if (!(allowed as readonly string[]).includes(s)) fail(field, `valeurs autorisées : ${allowed.join(", ")}`);
  return s as T;
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function vPagination(searchParams: URLSearchParams): Pagination {
  const rawPage = searchParams.get("page") ?? String(PAGE_DEFAULT);
  const rawLimit = searchParams.get("limit") ?? String(LIMIT_DEFAULT);
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isInteger(page) || page < 1) throw ApiError.validation("Requête invalide.", [{ field: "page", issue: "entier >= 1" }]);
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
    throw ApiError.validation("Requête invalide.", [{ field: "limit", issue: `entier entre 1 et ${LIMIT_MAX}` }]);
  return { page, limit, offset: (page - 1) * limit };
}

/** Rejette les valeurs inattendues d'un body JSON plat (anti-abus). */
export function vPlainObject(value: unknown, field = "body"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(field, "objet JSON attendu");
  return value as Record<string, unknown>;
}
