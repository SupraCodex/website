
import type { ContentRow } from "./repository.ts";
import type { ContentStatus, ContentType } from "./validate.ts";

export interface ArticleAdmin {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string;
  body: unknown[];
  status: ContentStatus;
  authorId: string | null;
  categoryId: string | null;
  coverMediaId: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toArticleAdmin(r: ContentRow): ArticleAdmin {
  return {
    id: r.id,
    type: r.type,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    status: r.status,
    authorId: r.author_id,
    categoryId: r.category_id,
    coverMediaId: r.cover_media_id,
    publishedAt: r.published_at,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
