import { ApiError } from "../api/errors.ts";
import { ZodError } from "zod";
import type { ZodIssue } from "zod";
import {
  ContactInputSchema,
  CONTACT_LIMITS,
  MessageStatusInputSchema,
  MediaUploadInputSchema,
  ALLOWED_MEDIA_MIME_TYPES,
  ArticleInputSchema,
  PaginationSchema,
  SlugSchema,
  UuidSchema,
  ContentTypeSchema,
  ContentStatusSchema,
} from "./schemas.ts";

function zodToFieldIssues(error: ZodError): { field: string; issue: string }[] {
  return error.issues.map((issue) => {
    const field = issue.path.join(".") || issue.path[0]?.toString() || "body";
    let message = issue.message;
    const i = issue as ZodIssue & { options?: unknown[]; minimum?: number; maximum?: number };
    if (Array.isArray(i.options)) {
      message = `valeurs autorisées : ${i.options.join(", ")}`;
    }
    if (typeof i.minimum === "number") {
      message = `longueur minimale ${i.minimum}`;
    }
    if (typeof i.maximum === "number") {
      message = `longueur maximale ${i.maximum}`;
    }
    return { field, issue: message };
  });
}

export function validateZod<T>(schema: { parse: (input: unknown) => T }, input: unknown, _context = "body"): T {
  try {
    return schema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      throw ApiError.validation("Requête invalide.", zodToFieldIssues(e));
    }
    throw ApiError.internal();
  }
}

export {
  PaginationSchema,
  SlugSchema,
  UuidSchema,
  ContentTypeSchema,
  ContentStatusSchema,
  ContactInputSchema,
  CONTACT_LIMITS,
  ArticleInputSchema,
  MessageStatusInputSchema,
  MediaUploadInputSchema,
  ALLOWED_MEDIA_MIME_TYPES,
};
