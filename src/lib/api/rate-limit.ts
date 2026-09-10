
import { ApiError } from "./errors.ts";

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitRule {
  name: string;
  max: number;
  windowMs: number;
}

/**
 * Limite lisible depuis l'environnement (recette locale), avec repli sûr :
 * absence ou valeur invalide => défaut de production. Borné pour éviter
 * qu'une variable erronée ne désactive la protection.
 */
function envMax(name: string, fallback: number, ceiling: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > ceiling) return fallback;
  return n;
}

export const CONTACT_RULES: RateLimitRule[] = [
  { name: "contact_15min", max: envMax("CONTACT_RATE_MAX_15MIN", 5, 500), windowMs: 15 * 60 * 1000 },
  { name: "contact_1h", max: envMax("CONTACT_RATE_MAX_1H", 20, 2000), windowMs: 60 * 60 * 1000 },
];

/** Empreinte non réversible (pas d'adresse IP stockée en clair). */
export function hashIdentity(identity: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < identity.length; i++) {
    h1 = Math.imul(h1 ^ identity.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + identity.charCodeAt(i), 2654435761) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

function prune(bucket: Bucket, now: number, windowMs: number): void {
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
}

/** Vérifie les règles pour une identité ; lève RATE_LIMITED si dépassée. */
export function enforceRateLimit(identity: string, rules: RateLimitRule[] = CONTACT_RULES, now = Date.now()): void {
  const key = hashIdentity(identity);
  for (const rule of rules) {
    const mapKey = `${rule.name}:${key}`;
    const bucket = buckets.get(mapKey) ?? { timestamps: [] };
    prune(bucket, now, rule.windowMs);
    if (bucket.timestamps.length >= rule.max) {
      buckets.set(mapKey, bucket);
      throw ApiError.rateLimited();
    }
    bucket.timestamps.push(now);
    buckets.set(mapKey, bucket);
  }
}

/** Réinitialise l'état (tests uniquement). */
export function resetRateLimit(): void {
  buckets.clear();
}
