
import { ApiError } from "../errors.ts";
import { getConfig } from "../auth.ts";
import type { AppRoleCode } from "../auth.ts";
import { adminInsert, adminFetchList, adminFetchOne, adminUpdate, adminDelete, type MediaAssetRow } from "./media-repository.ts";
import { validateMediaUpload, isMimeExtensionConsistent, type MediaUploadInput, type MediaVisibility } from "./media-validate.ts";

export interface MediaDeps {
  insert?: typeof adminInsert;
  fetchList?: typeof adminFetchList;
  fetchOne?: typeof adminFetchOne;
  update?: typeof adminUpdate;
  delete?: typeof adminDelete;
  now?: () => Date;
}

export interface UploadResult {
  id: string;
  storagePath: string;
  publicUrl: string | null;
}

export async function uploadMedia(
  actor: { id: string; role: AppRoleCode },
  input: MediaUploadInput,
  filename: string,
  fileBuffer: Buffer | Uint8Array,
  deps: MediaDeps = {},
): Promise<UploadResult> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const validated = validateMediaUpload({ ...input, sizeBytes: fileBuffer.length });
  if (!isMimeExtensionConsistent(filename, validated.mimeType)) {
    throw ApiError.validation("Requête invalide.", [{ field: "mimeType", issue: "incohérence MIME/extension" }]);
  }
  const cfg = getConfig();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const objectPath = `${crypto.randomUUID()}.${ext}`;
  const bucket = validated.visibility;
  const storagePath = `${validated.visibility}/${objectPath}`;
  const uploadRes = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}`, "content-type": validated.mimeType, "x-upsert": "false" },
    body: fileBuffer as never,
  });
  if (!uploadRes.ok) throw ApiError.internal();
  const insert = deps.insert ?? adminInsert;
  const row = await insert<MediaAssetRow>("media_assets", {
    logical_name: validated.logicalName, storage_path: storagePath,
    extension: ext, mime_type: validated.mimeType,
    size_bytes: validated.sizeBytes, width: validated.width, height: validated.height,
    alt_text: validated.altText, is_decorative: validated.isDecorative,
    caption: validated.caption, source: validated.source, license: validated.license,
    author: validated.author, visibility: validated.visibility,
  });
  const created = Array.isArray(row) ? row[0] : row;
  const publicUrl = bucket === "public" ? `${cfg.supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}` : null;
  return { id: created.id, storagePath, publicUrl };
}

export async function createSignedUrl(
  actor: { id: string; role: AppRoleCode }, mediaId: string, expiresIn = 3600, deps: MediaDeps = {},
): Promise<{ url: string; expiresAt: string }> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const cfg = getConfig();
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const row = await fetchOne<MediaAssetRow>("media_assets", { id: `eq.${mediaId}` });
  if (!row) throw ApiError.notFound();
  const now = deps.now ?? (() => new Date());
  const expiresAt = new Date(now().getTime() + expiresIn * 1000);
  // storage_path contient déjà le préfixe visibility/ (ex: public/uuid.png)
  const objectPath = row.storage_path.split("/").slice(1).join("/");
  const res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/sign/${row.visibility}/${objectPath}`, {
    method: "POST",
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw ApiError.internal();
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw ApiError.internal();
  const url = body.signedURL.startsWith("http") ? body.signedURL : `${cfg.supabaseUrl}${body.signedURL}`;
  return { url, expiresAt: expiresAt.toISOString() };
}

export async function listMedia(
  actor: { id: string; role: AppRoleCode }, opts: { page: number; limit: number; visibility?: MediaVisibility }, deps: MediaDeps = {},
): Promise<{ rows: MediaAssetRow[]; total: number }> {
  if (!["admin", "editor"].includes(actor.role)) throw ApiError.forbidden();
  const filters: Record<string, string> = {};
  if (opts.visibility) filters.visibility = `eq.${opts.visibility}`;
  const fetchList = deps.fetchList ?? adminFetchList;
  return fetchList<MediaAssetRow>("media_assets", { page: opts.page, limit: opts.limit, filters, order: "imported_at.desc" });
}
