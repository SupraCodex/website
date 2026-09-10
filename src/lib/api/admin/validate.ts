
import { z } from "zod";
import {
  validateZod,
  ArticleInputSchema,
  MessageStatusInputSchema,
  ContentTypeSchema,
  ContentStatusSchema,
} from "../../validators/index.ts";

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;

export type ArticleInput = z.infer<typeof ArticleInputSchema>;

export function validateArticle(body: unknown): ArticleInput {
  return validateZod(ArticleInputSchema, body, "body");
}

export type MessageStatusInput = z.infer<typeof MessageStatusInputSchema>;

export function validateMessageStatus(body: unknown): MessageStatusInput {
  return validateZod(MessageStatusInputSchema, body, "body");
}
