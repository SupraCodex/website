
import { ApiError } from "../errors.ts";
import type { AppRoleCode } from "../auth.ts";
import { adminFetchList, adminFetchOne, adminInsert, adminUpdate, adminDelete, type ContentRow, type DashboardStats } from "./repository.ts";
import { applyTransition, checkPublishability } from "./workflow.ts";
import { validateArticle } from "./validate.ts";
import { toArticleAdmin, type ArticleAdmin } from "./mappers.ts";
import type { ContentStatus } from "./validate.ts";

export interface AdminDeps {
  insert?: typeof adminInsert;
  update?: typeof adminUpdate;
  fetchOne?: typeof adminFetchOne;
  fetchList?: typeof adminFetchList;
  delete?: typeof adminDelete;
  now?: () => Date;
}

export type ContentAction = "submit" | "publish" | "archive" | "unarchive" | "reject" | "delete";

export async function getDashboard(actor: { id: string; role: AppRoleCode }): Promise<DashboardStats> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const all = await adminFetchList<ContentRow>("content_items", {
    page: 1, limit: 200, order: "updated_at.desc", select: "status",
  });
  const byStatus: Record<string, number> = {};
  for (const r of all.rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const msg = await adminFetchList<{ id: string }>("contact_messages", {
    page: 1, limit: 1, filters: { status: "eq.new" }, select: "id",
  });
  return { total: all.rows.length, byStatus, recentMessages: msg.total };
}

export async function listArticles(
  actor: { id: string; role: AppRoleCode },
  opts: { page: number; limit: number; status?: ContentStatus },
): Promise<{ rows: ArticleAdmin[]; total: number }> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const filters: Record<string, string> = {};
  if (opts.status) filters.status = `eq.${opts.status}`;
  const result = await adminFetchList<ContentRow>("content_items", {
    page: opts.page, limit: opts.limit, filters, order: "updated_at.desc",
    select: "id,type,slug,title,excerpt,body,status,author_id,category_id,cover_media_id,published_at,archived_at,created_at,updated_at",
  });
  return { rows: result.rows.map(toArticleAdmin), total: result.total };
}

export async function getArticle(actor: { id: string; role: AppRoleCode }, id: string): Promise<ArticleAdmin> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const row = await adminFetchOne<ContentRow>("content_items", { id: `eq.${id}` });
  if (!row) throw ApiError.notFound();
  return toArticleAdmin(row);
}

export async function createArticle(
  actor: { id: string; role: AppRoleCode }, body: unknown, deps: AdminDeps = {},
): Promise<ArticleAdmin> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const input = validateArticle(body);
  const insert = deps.insert ?? adminInsert;
  const row = await insert<ContentRow>("content_items", {
    type: input.type, slug: input.slug, title: input.title, excerpt: input.excerpt,
    body: input.body, status: "draft", author_id: actor.id, category_id: input.categoryId, cover_media_id: input.coverMediaId,
  });
  return toArticleAdmin(Array.isArray(row) ? row[0] : row);
}

export async function updateArticle(
  actor: { id: string; role: AppRoleCode }, id: string, body: unknown, deps: AdminDeps = {},
): Promise<ArticleAdmin> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const input = validateArticle(body);
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const existing = await fetchOne<ContentRow>("content_items", { id: `eq.${id}` });
  if (!existing) throw ApiError.notFound();
  if (existing.status === "published") throw ApiError.conflict("Contenu publié : utilisez les transitions.");
  const update = deps.update ?? adminUpdate;
  const row = await update<ContentRow>("content_items", { id: `eq.${id}` }, {
    type: input.type, slug: input.slug, title: input.title, excerpt: input.excerpt,
    body: input.body, category_id: input.categoryId, cover_media_id: input.coverMediaId, updated_at: new Date().toISOString(),
  });
  return toArticleAdmin(Array.isArray(row) ? row[0] : row);
}

export async function transitionArticle(
  actor: { id: string; role: AppRoleCode }, id: string, action: ContentAction, deps: AdminDeps = {},
): Promise<ArticleAdmin> {
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const update = deps.update ?? adminUpdate;
  const existing = await fetchOne<ContentRow>("content_items", { id: `eq.${id}` });
  if (!existing) throw ApiError.notFound();
  if (action === "publish") {
    const report = checkPublishability({ title: existing.title, excerpt: existing.excerpt, body: existing.body, coverMediaId: existing.cover_media_id });
    if (!report.publishable) throw ApiError.conflict(`Publication impossible : ${report.reasons.join(", ")}.`);
  }
  const result = applyTransition(existing.status, action, actor.role);
  const patch: Record<string, unknown> = { status: result.next, updated_at: new Date().toISOString() };
  if (result.setPublishedAt) patch.published_at = new Date().toISOString();
  if (result.setArchivedAt) patch.archived_at = new Date().toISOString();
  if (result.clearArchivedAt) patch.archived_at = null;
  const row = await update<ContentRow>("content_items", { id: `eq.${id}` }, patch);
  return toArticleAdmin(Array.isArray(row) ? row[0] : row);
}

export async function deleteArticle(actor: { id: string; role: AppRoleCode }, id: string, deps: AdminDeps = {}): Promise<void> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const del = deps.delete ?? adminDelete;
  const existing = await fetchOne<ContentRow>("content_items", { id: `eq.${id}` });
  if (!existing) throw ApiError.notFound();
  if (existing.status === "published") throw ApiError.conflict("Archivez d'abord le contenu publié.");
  await del("content_items", { id: `eq.${id}` });
}
