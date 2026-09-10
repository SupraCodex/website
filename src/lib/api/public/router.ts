
import { ApiError } from "../errors.ts";
import { handleRoute, jsonOk } from "../respond.ts";
import { vPagination, vString } from "../validate.ts";
import { fetchList, fetchOne, PUBLISHED_FILTER } from "./repository.ts";
import {
  toArticlePublic,
  toExpertisePublic,
  toJobPublic,
  toProjectPublic,
  toSiteConfigPublic,
  type ContentRow,
} from "./mappers.ts";
import { handleContactSubmission } from "./contact-service.ts";

const SLUG_MAX = 160;
const Q_MAX = 100;

function safeSlug(v: unknown, field: string): string {
  const s = vString(v, field, { max: SLUG_MAX, required: true });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) throw ApiError.validation("Requête invalide.", [{ field, issue: "format de slug invalide" }]);
  return s;
}

function safeQ(v: string | null): string {
  const s = vString(v ?? "", "q", { max: Q_MAX });
  // Recherche limitée aux champs indexés ; neutralisation des caractères PostgREST.
  return s.replace(/[(),*]/g, " ").trim();
}

async function listContent(type: "article" | "announcement" | "career", url: URL, requestId: string): Promise<Response> {
  const { page, limit } = vPagination(url.searchParams);
  const filters: Record<string, string> = { type: `eq.${type}`, status: PUBLISHED_FILTER };
  const category = url.searchParams.get("category");
  if (category) filters["categories.slug"] = `eq.${safeSlug(category, "category")}`;
  safeQ(url.searchParams.get("q")); // validé même si la recherche full-text arrive plus tard
  // !inner : sans jointure interne, PostgREST ignorerait le filtre sur la ressource imbriquée.
  const select = category ? "slug,title,excerpt,status,published_at,categories!inner(slug)" : "slug,title,excerpt,status,published_at,categories(slug)";
  const result = await fetchList<ContentRow>("content_items", {
    page, limit, filters, order: "published_at.desc.nullslast", select,
  });
  const rows = result.rows.filter((r) => r.status === "published"); // double verrou serveur
  const mapper = type === "career" ? toJobPublic : toArticlePublic;
  return jsonOk(rows.map(mapper), { requestId, cache: "public-short" }, { page, limit, total: result.total });
}

async function getContent(type: "article" | "announcement" | "career", slug: string, requestId: string): Promise<Response> {
  const row = await fetchOne<ContentRow & { body?: unknown }>("content_items", {
    type: `eq.${type}`,
    slug: `eq.${slug}`,
    status: PUBLISHED_FILTER,
  }, "slug,title,excerpt,body,status,published_at");
  // 404 identique pour slug absent, brouillon, archivé ou planifié : aucune divulgation.
  if (!row || row.status !== "published") throw ApiError.notFound();
  const mapper = type === "career" ? toJobPublic : toArticlePublic;
  const base = mapper(row) as unknown as Record<string, unknown>;
  base.body = row.body ?? [];
  return jsonOk(base, { requestId, cache: "public-short" });
}

export { safeSlug };

/** Identité de rate limit : empreinte d'IP forwardée si présente, sinon "inconnue". */
function clientIdentity(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim() ?? "";
  return first || "inconnue";
}

export async function handlePublicApi(req: Request): Promise<Response> {
  return handleRoute(req, async (requestId) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/v1/, "").replace(/\/+$/, "") || "/";

    if (req.method === "POST" && path === "/contact-messages") {
      const bodyText = await req.text();
      // Garde-fou de taille (aucun body volumineux n'est attendu ici).
      if (bodyText.length > 8192) throw ApiError.validation("Requête invalide.", [{ field: "body", issue: "taille excessive" }]);
      let parsed: unknown = null;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        throw ApiError.validation("Requête invalide.", [{ field: "body", issue: "JSON invalide" }]);
      }
      const identity = clientIdentity(req);
      const outcome = await handleContactSubmission(parsed, identity, requestId);
      return new Response(JSON.stringify(outcome.body), {
        status: outcome.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "x-request-id": requestId,
        },
      });
    }

    if (req.method !== "GET") throw ApiError.notFound();

    if (path === "/expertises") {
      const { page, limit } = vPagination(url.searchParams);
      const filters: Record<string, string> = { status: PUBLISHED_FILTER };
      const tag = url.searchParams.get("tag");
      if (tag) filters["slug"] = `eq.${safeSlug(tag, "tag")}`; // tag = slug d'expertise (contrat)
      const result = await fetchList<Record<string, unknown>>("expertises", {
        page, limit, filters, order: "title.asc", select: "slug,title,summary,description,icon_key,status",
      });
      return jsonOk(result.rows.filter((r) => r.status === "published").map(toExpertisePublic), { requestId, cache: "public-short" }, { page, limit, total: result.total });
    }

    const expertiseMatch = /^\/expertises\/([^/]+)$/.exec(path);
    if (expertiseMatch) {
      const slug = safeSlug(decodeURIComponent(expertiseMatch[1]), "slug");
      const row = await fetchOne<Record<string, unknown>>("expertises", { slug: `eq.${slug}`, status: PUBLISHED_FILTER }, "slug,title,summary,description,icon_key,status");
      if (!row || row.status !== "published") throw ApiError.notFound();
      return jsonOk(toExpertisePublic(row), { requestId, cache: "public-short" });
    }

    if (path === "/projects") {
      const { page, limit } = vPagination(url.searchParams);
      const filters: Record<string, string> = { status: PUBLISHED_FILTER };
      const featured = url.searchParams.get("featured");
      if (featured !== null) {
        if (!["true", "false"].includes(featured)) throw ApiError.validation("Requête invalide.", [{ field: "featured", issue: "booléen attendu" }]);
        filters.featured = `eq.${featured}`;
      }
      const expertise = url.searchParams.get("expertise");
      let select = "slug,title,summary,featured,published_at,status";
      if (expertise) {
        // !inner : jointure interne obligatoire pour que le filtre imbriqué s'applique réellement.
        select = "slug,title,summary,featured,published_at,status,project_expertises!inner(expertises!inner(slug))";
        filters["project_expertises.expertises.slug"] = `eq.${safeSlug(expertise, "expertise")}`;
      }
      const result = await fetchList<Record<string, unknown>>("projects", {
        page, limit, filters, order: "published_at.desc.nullslast", select,
      });
      return jsonOk(result.rows.filter((r) => r.status === "published").map(toProjectPublic), { requestId, cache: "public-short" }, { page, limit, total: result.total });
    }

    const projectMatch = /^\/projects\/([^/]+)$/.exec(path);
    if (projectMatch) {
      const slug = safeSlug(decodeURIComponent(projectMatch[1]), "slug");
      const row = await fetchOne<Record<string, unknown>>("projects", { slug: `eq.${slug}`, status: PUBLISHED_FILTER }, "slug,title,summary,featured,published_at,status");
      if (!row || row.status !== "published") throw ApiError.notFound();
      return jsonOk(toProjectPublic(row), { requestId, cache: "public-short" });
    }

    if (path === "/articles") return listContent("article", url, requestId);
    const articleMatch = /^\/articles\/([^/]+)$/.exec(path);
    if (articleMatch) return getContent("article", safeSlug(decodeURIComponent(articleMatch[1]), "slug"), requestId);

    if (path === "/careers") return listContent("career", url, requestId);
    const careerMatch = /^\/careers\/([^/]+)$/.exec(path);
    if (careerMatch) return getContent("career", safeSlug(decodeURIComponent(careerMatch[1]), "slug"), requestId);

    if (path === "/site-config/public") {
      const result = await fetchList<{ key: string; value: string }>("site_settings", {
        page: 1, limit: 100, filters: { is_public: "eq.true" }, order: "key.asc", select: "key,value",
      });
      return jsonOk(toSiteConfigPublic(result.rows), { requestId, cache: "public-short" });
    }

    throw ApiError.notFound();
  });
}
