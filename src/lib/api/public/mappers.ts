
export interface ExpertisePublic {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  iconKey: string | null;
}

export interface ProjectPublic {
  slug: string;
  title: string;
  summary: string | null;
  featured: boolean;
  publishedAt: string | null;
}

export interface ArticlePublic {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
}

export interface JobPublic {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
}

export interface SiteConfigPublic {
  settings: Record<string, string>;
}

export interface ContentRow {
  slug: string;
  title: string;
  excerpt: string;
  status: string;
  published_at: string | null;
  [k: string]: unknown;
}

export function toExpertisePublic(r: Record<string, unknown>): ExpertisePublic {
  return {
    slug: String(r.slug),
    title: String(r.title),
    summary: (r.summary as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    iconKey: (r.icon_key as string | null) ?? null,
  };
}

export function toProjectPublic(r: Record<string, unknown>): ProjectPublic {
  return {
    slug: String(r.slug),
    title: String(r.title),
    summary: (r.summary as string | null) ?? null,
    featured: Boolean(r.featured),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

export function toArticlePublic(r: ContentRow): ArticlePublic {
  return { slug: r.slug, title: r.title, excerpt: r.excerpt, publishedAt: r.published_at };
}

export function toJobPublic(r: ContentRow): JobPublic {
  return { slug: r.slug, title: r.title, excerpt: r.excerpt, publishedAt: r.published_at };
}

export function toSiteConfigPublic(rows: { key: string; value: string }[]): SiteConfigPublic {
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return { settings };
}
