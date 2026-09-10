import { z } from "zod";

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1, "page >= 1").default(1),
  limit: z.coerce.number().int().min(1, "limit >= 1").max(50, "limit <= 50").default(10),
});

export const SlugSchema = z.string().min(1, "slug requis").max(160, "slug <= 160").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "format slug invalide");

export const CONTACT_LIMITS = {
  name: { min: 2, max: 120 },
  sujet: { min: 2, max: 200 },
  message: { min: 10, max: 4000 },
} as const;

export const ContactInputSchema = z.object({
  name: z.string().trim().min(CONTACT_LIMITS.name.min, "name trop court").max(CONTACT_LIMITS.name.max, "name <= 120"),
  email: z.string().trim().toLowerCase().min(1, "email requis").max(320, "email <= 320").email("email invalide"),
  sujet: z.string().trim().min(CONTACT_LIMITS.sujet.min, "sujet trop court").max(CONTACT_LIMITS.sujet.max, "sujet <= 200"),
  message: z.string().trim().min(CONTACT_LIMITS.message.min, "message trop court").max(CONTACT_LIMITS.message.max, "message <= 4000"),
  // Honeypot : jamais une erreur de validation (réponse neutre côté service).
  website: z.string().max(200).optional().default(""),
});

export type ContactInput = z.infer<typeof ContactInputSchema>;

export const ArticleInputSchema = z.object({
  type: z.enum(["article", "announcement", "career"]),
  title: z.string().min(1, "title requis").max(200, "title <= 200"),
  excerpt: z.string().min(1, "excerpt requis").max(600, "excerpt <= 600"),
  slug: z.string().min(1, "slug requis").max(160, "slug <= 160").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "format slug invalide"),
  body: z.array(z.unknown()).max(200, "trop de blocs (max 200)"),
  categoryId: z.string().uuid().optional().nullable(),
  coverMediaId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
});

export type ArticleInput = z.infer<typeof ArticleInputSchema>;

export const MessageStatusInputSchema = z.object({
  status: z.enum(["new", "read", "replied", "closed"]),
  assignedTo: z.string().uuid().optional().nullable(),
});

export type MessageStatusInput = z.infer<typeof MessageStatusInputSchema>;

export const ALLOWED_MEDIA_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml", "application/pdf",
] as const;

export const MediaUploadInputSchema = z.object({
  logicalName: z.string().min(1, "logicalName requis").max(255, "logicalName <= 255"),
  mimeType: z.string().max(120, "mimeType <= 120").refine((v) => (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(v), "type MIME non autorisé"),
  sizeBytes: z.number().positive("taille > 0").max(10 * 1024 * 1024, "taille maximale 10 Mo"),
  width: z.number().int().positive("width > 0").optional().nullable(),
  height: z.number().int().positive("height > 0").optional().nullable(),
  altText: z.string().max(500, "altText <= 500").optional().nullable(),
  isDecorative: z.boolean().optional().default(false),
  caption: z.string().max(1000, "caption <= 1000").optional().nullable(),
  source: z.string().max(500, "source <= 500").optional().nullable(),
  license: z.string().max(200, "license <= 200").optional().nullable(),
  author: z.string().max(200, "author <= 200").optional().nullable(),
  visibility: z.enum(["public", "private", "archive"]),
});

export type MediaUploadInput = z.infer<typeof MediaUploadInputSchema>;

export const UuidSchema = z.string().uuid("identifiant invalide");

export const ContentTypeSchema = z.enum(["article", "announcement", "career"]);

export const ContentStatusSchema = z.enum(["draft", "review", "published", "archived"]);
