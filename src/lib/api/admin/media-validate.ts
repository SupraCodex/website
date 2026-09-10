
import { z } from "zod";
import { ApiError } from "../errors.ts";
import { validateZod, MediaUploadInputSchema, ALLOWED_MEDIA_MIME_TYPES } from "../../validators/index.ts";

export const MEDIA_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10 Mo
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"],
  allowedDocumentTypes: ["application/pdf"],
  allowedTypes: ALLOWED_MEDIA_MIME_TYPES,
  maxFilenameLength: 255,
} as const;

export type MediaVisibility = "public" | "private" | "archive";

export type MediaUploadInput = z.infer<typeof MediaUploadInputSchema>;

const FilenameSchema = z.string()
  .min(1, "filename requis")
  .max(MEDIA_LIMITS.maxFilenameLength, `filename <= ${MEDIA_LIMITS.maxFilenameLength}`)
  .refine((s) => !s.includes("/") && !s.includes("\\") && !s.includes("..") && !s.includes("\0"), "nom de fichier invalide")
  .refine((s) => {
    const ext = s.split(".").pop()?.toLowerCase() ?? "";
    return ["jpg", "jpeg", "png", "webp", "avif", "svg", "pdf"].includes(ext);
  }, "extension non autorisée");

const MimeTypeSchema = z.string()
  .max(120, "mimeType <= 120")
  .refine((s) => MEDIA_LIMITS.allowedTypes.includes(s as never), "type MIME non autorisé");

const FileSizeSchema = z.number()
  .positive("taille > 0")
  .max(MEDIA_LIMITS.maxFileSize, `taille maximale ${MEDIA_LIMITS.maxFileSize} octets`);



export function vFilename(value: unknown, field = "filename"): string {
  return validateZod(FilenameSchema, value, field);
}

export function vMimeType(value: unknown, field = "mimeType"): string {
  return validateZod(MimeTypeSchema, value, field);
}

export function vFileSize(value: unknown, field = "sizeBytes"): number {
  return validateZod(FileSizeSchema, value, field);
}

export function validateMediaUpload(body: unknown): MediaUploadInput {
  const parsed = validateZod(MediaUploadInputSchema, body, "body");

  if (!parsed.isDecorative && !parsed.altText) {
    throw ApiError.validation("Requête invalide.", [{ field: "altText", issue: "texte alternatif requis (ou marquer comme décoratif)" }]);
  }

  return parsed;
}

export function isMimeExtensionConsistent(filename: string, mimeType: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/avif": ["avif"],
    "image/svg+xml": ["svg"],
    "application/pdf": ["pdf"],
  };
  return (map[mimeType] ?? []).includes(ext);
}
