
import { getConfig } from "../auth.ts";
import type { AppRoleCode } from "../auth.ts";
import type { ContentStatus, ContentType } from "./validate.ts";

function serviceHeaders(prefer?: string): Record<string, string> {
  const cfg = getConfig();
  const h: Record<string, string> = {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    "content-type": "application/json",
  };
  if (prefer) h.prefer = prefer;
  return h;
}

export interface AdminListResult<T> {
  rows: T[];
  total: number;
}

export async function adminFetchList<T>(
  table: string,
  opts: {
    page: number;
    limit: number;
    filters?: Record<string, string>;
    order?: string;
    select?: string;
  },
): Promise<AdminListResult<T>> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  params.set("select", opts.select ?? "*");
  for (const [col, value] of Object.entries(opts.filters ?? {})) params.set(col, value);
  if (opts.order) params.set("order", opts.order);
  params.set("limit", String(opts.limit));
  params.set("offset", String((opts.page - 1) * opts.limit));
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, {
    headers: { ...serviceHeaders(), prefer: "count=exact" },
  });
  if (res.status === 416) {
    const countParams = new URLSearchParams(params);
    countParams.set("limit", "1");
    countParams.set("offset", "0");
    const countRes = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${countParams}`, {
      headers: { ...serviceHeaders(), prefer: "count=exact" },
    });
    if (!countRes.ok) throw new Error(`upstream_${countRes.status}`);
    const contentRange = countRes.headers.get("content-range") ?? "";
    const total = Number(contentRange.split("/")[1] ?? 0);
    return { rows: [], total: Number.isFinite(total) ? total : 0 };
  }
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const contentRange = res.headers.get("content-range") ?? "";
  const total = Number(contentRange.split("/")[1] ?? 0);
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

export async function adminInsert<T>(table: string, body: unknown, prefer = "return=representation"): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: serviceHeaders(prefer),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  return (await res.json()) as T;
}

export async function adminUpdate<T>(table: string, filters: Record<string, string>, body: unknown, prefer = "return=representation"): Promise<T> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  for (const [col, value] of Object.entries(filters)) params.set(col, value);
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, {
    method: "PATCH",
    headers: serviceHeaders(prefer),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  return (await res.json()) as T;
}

export async function adminDelete(table: string, filters: Record<string, string>): Promise<void> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  for (const [col, value] of Object.entries(filters)) params.set(col, value);
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?${params}`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
}

export interface ContentRow {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string;
  body: unknown[];
  status: ContentStatus;
  author_id: string | null;
  category_id: string | null;
  cover_media_id: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  roles?: { code: AppRoleCode }[];
}

export interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  recentMessages: number;
}
