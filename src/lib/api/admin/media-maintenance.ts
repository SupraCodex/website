
import { ApiError } from "../errors.ts";
import { getConfig } from "../auth.ts";
import type { AppRoleCode } from "../auth.ts";
import { adminFetchOne, adminUpdate, adminFetchList, adminDelete, type MediaAssetRow } from "./media-repository.ts";
import type { MediaUploadInput } from "./media-validate.ts";
import type { MediaDeps } from "./media-service.ts";

export async function updateMediaMetadata(
  actor: { id: string; role: AppRoleCode }, mediaId: string, body: Partial<MediaUploadInput>, deps: MediaDeps = {},
): Promise<MediaAssetRow> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const update = deps.update ?? adminUpdate;
  const existing = await fetchOne<MediaAssetRow>("media_assets", { id: `eq.${mediaId}` });
  if (!existing) throw ApiError.notFound();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.logicalName !== undefined) patch.logical_name = body.logicalName;
  if (body.altText !== undefined) patch.alt_text = body.altText;
  if (body.isDecorative !== undefined) patch.is_decorative = body.isDecorative;
  if (body.caption !== undefined) patch.caption = body.caption;
  if (body.source !== undefined) patch.source = body.source;
  if (body.license !== undefined) patch.license = body.license;
  if (body.author !== undefined) patch.author = body.author;
  if (body.isDecorative === false && !patch.alt_text && !existing.alt_text) {
    throw ApiError.validation("Requête invalide.", [{ field: "altText", issue: "texte alternatif requis" }]);
  }
  const row = await update<MediaAssetRow>("media_assets", { id: `eq.${mediaId}` }, patch);
  return Array.isArray(row) ? row[0] : row;
}

export interface OrphanReport {
  orphans: { id: string; storagePath: string }[];
  total: number;
}

/** Rapport de fichiers orphelins (média non référencé par aucun contenu/projet). */
export async function findOrphanMedia(
  actor: { id: string; role: AppRoleCode }, deps: MediaDeps = {},
): Promise<OrphanReport> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const fetchList = deps.fetchList ?? adminFetchList;
  const mediaAssets = await fetchList<MediaAssetRow>("media_assets", { page: 1, limit: 500, order: "imported_at.desc" });
  const referenced = new Set<string>();

  // Références depuis content_items
  const contentRefs = await fetchList<{ cover_media_id: string }>("content_items", {
    page: 1, limit: 500, filters: { cover_media_id: "not.is.null" }, select: "cover_media_id",
  });
  for (const r of contentRefs.rows) referenced.add(r.cover_media_id);

  // Références depuis project_media
  const projectRefs = await fetchList<{ media_id: string }>("project_media", {
    page: 1, limit: 500, select: "media_id",
  });
  for (const r of projectRefs.rows) referenced.add(r.media_id);

  const orphans = mediaAssets.rows.filter((m) => !referenced.has(m.id)).map((m) => ({ id: m.id, storagePath: m.storage_path }));
  return { orphans, total: orphans.length };
}

export async function deleteMedia(
  actor: { id: string; role: AppRoleCode }, mediaId: string, deps: MediaDeps = {},
): Promise<void> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const cfg = getConfig();
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const del = deps.delete ?? adminDelete;
  const existing = await fetchOne<MediaAssetRow>("media_assets", { id: `eq.${mediaId}` });
  if (!existing) throw ApiError.notFound();

  // Extraire le chemin relatif (storage_path = "visibility/objectPath")
  const objectPath = existing.storage_path.split("/").slice(1).join("/");
  const storageRes = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${existing.visibility}/${objectPath}`, {
    method: "DELETE",
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  if (!storageRes.ok) throw ApiError.internal();

  await del("media_assets", { id: `eq.${mediaId}` });
}

/**
 * Rapport de dérivés.
 *
 * Le dépôt ne contient pas encore de pipeline de génération ni de table de
 * dérivés. Retourner des tailles estimées ferait passer une hypothèse pour
 * une preuve d'exécution ; le contrat expose donc honnêtement une collection
 * vide jusqu'à l'intégration de ce pipeline.
 */
export async function getDerivedMedia(
  actor: { id: string; role: AppRoleCode }, mediaId: string, deps: MediaDeps = {},
): Promise<{ mediaId: string; derivatives: { suffix: string; width: number | null }[] }> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const existing = await fetchOne<MediaAssetRow>("media_assets", { id: `eq.${mediaId}` });
  if (!existing) throw ApiError.notFound();
  return { mediaId: existing.id, derivatives: [] };
}
