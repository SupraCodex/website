
import { ApiError } from "../errors.ts";
import type { AppRoleCode } from "../auth.ts";
import { adminFetchList, adminFetchOne, adminInsert, adminUpdate, type ContentRow } from "./repository.ts";
import { validateMessageStatus } from "./validate.ts";
import { toArticleAdmin, type ArticleAdmin } from "./mappers.ts";
import type { AdminDeps } from "./service.ts";

export async function listMessages(
  actor: { id: string; role: AppRoleCode },
  opts: { page: number; limit: number; status?: string },
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const filters: Record<string, string> = {};
  if (opts.status) filters.status = `eq.${opts.status}`;
  const result = await adminFetchList<Record<string, unknown>>("contact_messages", {
    page: opts.page, limit: opts.limit, filters, order: "created_at.desc",
  });
  return { rows: result.rows, total: result.total };
}

export async function updateMessageStatus(
  actor: { id: string; role: AppRoleCode }, id: string, body: unknown, deps: AdminDeps = {},
): Promise<Record<string, unknown>> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const input = validateMessageStatus(body);
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const update = deps.update ?? adminUpdate;
  const existing = await fetchOne<Record<string, unknown>>("contact_messages", { id: `eq.${id}` });
  if (!existing) throw ApiError.notFound();
  const row = await update<Record<string, unknown>>("contact_messages", { id: `eq.${id}` }, {
    status: input.status, assigned_to: input.assignedTo, updated_at: new Date().toISOString(),
  });
  return Array.isArray(row) ? row[0] : row;
}

export interface PreviewToken {
  token: string;
  expiresAt: string;
}

export async function createPreviewToken(
  actor: { id: string; role: AppRoleCode }, contentId: string, deps: AdminDeps = {},
): Promise<PreviewToken> {
  if (!["admin", "editor", "reviewer"].includes(actor.role)) throw ApiError.forbidden();
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const insert = deps.insert ?? adminInsert;
  const existing = await fetchOne<ContentRow>("content_items", { id: `eq.${contentId}` });
  if (!existing) throw ApiError.notFound();
  const now = deps.now ?? (() => new Date());
  const expiresAt = new Date(now().getTime() + 24 * 60 * 60 * 1000);
  const row = await insert<{ id: string; expires_at: string }>("preview_tokens", {
    content_id: contentId, created_by: actor.id, expires_at: expiresAt.toISOString(),
  });
  const created = Array.isArray(row) ? row[0] : row;
  return { token: created.id, expiresAt: created.expires_at };
}

export async function resolvePreviewToken(token: string, deps: AdminDeps = {}): Promise<ArticleAdmin | null> {
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const pt = await fetchOne<{ content_id: string; expires_at: string }>("preview_tokens", { id: `eq.${token}` });
  if (!pt) return null;
  if (new Date(pt.expires_at).getTime() < Date.now()) return null;
  const content = await fetchOne<ContentRow>("content_items", { id: `eq.${pt.content_id}` });
  if (!content) return null;
  return toArticleAdmin(content);
}
