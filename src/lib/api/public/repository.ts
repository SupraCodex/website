
import { getConfig } from "../auth.ts";

export interface ListResult<T> {
  rows: T[];
  total: number;
}

export interface ListOptions {
  page: number;
  limit: number;
  filters?: Record<string, string>; // colonne -> valeur PostgREST (ex: "eq.slug")
  order?: string; // ex: "published_at.desc"
  select?: string;
}

export function publicHeaders(): Record<string, string> {
  const cfg = getConfig();
  return { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` };
}

export async function fetchList<T>(table: string, opts: ListOptions): Promise<ListResult<T>> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  params.set("select", opts.select ?? "*");
  for (const [col, value] of Object.entries(opts.filters ?? {})) params.set(col, value);
  if (opts.order) params.set("order", opts.order);
  params.set("limit", String(opts.limit));
  params.set("offset", String((opts.page - 1) * opts.limit));
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, {
    headers: { ...publicHeaders(), prefer: "count=exact" },
  });
  if (res.status === 416) {
    const countParams = new URLSearchParams(params);
    countParams.set("limit", "1");
    countParams.set("offset", "0");
    const countRes = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${countParams}`, {
      headers: { ...publicHeaders(), prefer: "count=exact" },
    });
    if (!countRes.ok) throw new Error(`upstream_${countRes.status}`);
    const contentRange = countRes.headers.get("content-range") ?? "";
    const total = Number(contentRange.split("/")[1] ?? 0);
    return { rows: [], total: Number.isFinite(total) ? total : 0 };
  }
  if (!res.ok) throw new Error(`upstream_${res.status}`); // neutralisé en INTERNAL_ERROR par la couche HTTP
  const contentRange = res.headers.get("content-range") ?? "";
  const total = Number(contentRange.split("/")[1] ?? 0);
  return { rows: (await res.json()) as T[], total: Number.isFinite(total) ? total : 0 };
}

export async function fetchOne<T>(table: string, filters: Record<string, string>, select = "*"): Promise<T | null> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  params.set("select", select);
  for (const [col, value] of Object.entries(filters)) params.set(col, value);
  params.set("limit", "1");
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, {
    headers: publicHeaders(),
  });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

/** Filtre de statut public imposé côté serveur (jamais dérivé de la requête client). */
export const PUBLISHED_FILTER = "eq.published";
