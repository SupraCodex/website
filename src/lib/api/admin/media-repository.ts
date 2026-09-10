
import { getConfig } from "../auth.ts";

function serviceHeaders(prefer?: string): Record<string, string> {
  const cfg = getConfig();
  const h: Record<string, string> = { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}`, "content-type": "application/json" };
  if (prefer) h.prefer = prefer;
  return h;
}

export interface MediaAssetRow {
  id: string;
  logical_name: string;
  storage_path: string;
  extension: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  is_decorative: boolean;
  caption: string | null;
  source: string | null;
  license: string | null;
  author: string | null;
  visibility: string;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export async function adminInsert<T>(table: string, body: unknown, prefer = "return=representation"): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}`, { method: "POST", headers: serviceHeaders(prefer), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  return (await res.json()) as T;
}

export async function adminFetchList<T>(table: string, opts: { page: number; limit: number; filters?: Record<string, string>; order?: string; select?: string }): Promise<{ rows: T[]; total: number }> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  params.set("select", opts.select ?? "*");
  for (const [col, value] of Object.entries(opts.filters ?? {})) params.set(col, value);
  if (opts.order) params.set("order", opts.order);
  params.set("limit", String(opts.limit));
  params.set("offset", String((opts.page - 1) * opts.limit));
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, { headers: { ...serviceHeaders(), prefer: "count=exact" } });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const cr = res.headers.get("content-range") ?? "";
  const total = Number(cr.split("/")[1] ?? 0);
  return { rows: (await res.json()) as T[], total: Number.isFinite(total) ? total : 0 };
}

export async function adminFetchOne<T>(table: string, filters: Record<string, string>, select = "*"): Promise<T | null> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  params.set("select", select);
  for (const [col, value] of Object.entries(filters)) params.set(col, value);
  params.set("limit", "1");
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

export async function adminUpdate<T>(table: string, filters: Record<string, string>, body: unknown, prefer = "return=representation"): Promise<T> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  for (const [col, value] of Object.entries(filters)) params.set(col, value);
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, { method: "PATCH", headers: serviceHeaders(prefer), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  return (await res.json()) as T;
}

export async function adminDelete(table: string, filters: Record<string, string>): Promise<void> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  for (const [col, value] of Object.entries(filters)) params.set(col, value);
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, { method: "DELETE", headers: serviceHeaders() });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
}
