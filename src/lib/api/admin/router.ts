
import { ApiError } from "../errors.ts";
import { handleRoute, jsonOk } from "../respond.ts";
import { extractBearer, requireRole, refreshSession } from "../auth.ts";
import { vPagination, vUuid, vString, vEnum } from "../validate.ts";
import {
  getDashboard,
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  transitionArticle,
  deleteArticle,
  type ContentAction,
} from "./service.ts";
import { listMessages, updateMessageStatus, createPreviewToken, resolvePreviewToken } from "./service-messages.ts";
import { listUsers, assignRole, removeRole } from "./service-users.ts";
import { uploadMedia, createSignedUrl, listMedia } from "./media-service.ts";
import { updateMediaMetadata, findOrphanMedia, deleteMedia, getDerivedMedia } from "./media-maintenance.ts";

export async function handleAdminApi(req: Request): Promise<Response> {
  return handleRoute(req, async (requestId) => {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/v1\/admin/, "").replace(/\/+$/, "") || "/";
    const bearer = extractBearer(req.headers.get("authorization"));

    const previewMatch = /^\/preview\/([^/]+)$/.exec(path);
    if (previewMatch && req.method === "GET") {
      const token = vUuid(previewMatch[1], "token");
      const content = await resolvePreviewToken(token);
      if (!content) throw ApiError.notFound();
      return jsonOk(content, { requestId, cache: "no-store" });
    }

    if (req.method === "POST" && path === "/session/refresh") {
      // Le refresh token transite dans le corps (jamais dans l'URL ni les journaux).
      const body = (await req.json().catch(() => ({}))) as { refreshToken?: string };
      const session = await refreshSession(vString(body.refreshToken, "refreshToken", { max: 4096, required: true }));
      return jsonOk(session, { requestId, cache: "no-store" });
    }

    const { user, role } = await requireRole(bearer, ["admin", "editor", "reviewer", "readonly"]);
    const actor = { id: user.id, role };

    if (req.method === "GET" && path === "/me") {
      return jsonOk({ id: user.id, email: user.email, role }, { requestId, cache: "no-store" });
    }

    if (req.method === "GET" && path === "/dashboard") {
      const stats = await getDashboard(actor);
      return jsonOk(stats, { requestId, cache: "no-store" });
    }

    // ---- Gestion des comptes et rôles (admin uniquement) ----
    if (path === "/users" && req.method === "GET") {
      const { page, limit } = vPagination(url.searchParams);
      const result = await listUsers(actor, { page, limit });
      return jsonOk(result.rows, { requestId, cache: "no-store" }, { page, limit, total: result.total });
    }

    const userRoleMatch = /^\/users\/([^/]+)\/roles$/.exec(path);
    if (userRoleMatch && req.method === "POST") {
      const id = vUuid(userRoleMatch[1], "id");
      const body = (await req.json()) as { role?: unknown };
      const updated = await assignRole(actor, id, body.role);
      return jsonOk(updated, { requestId, cache: "no-store" });
    }

    const userRoleDeleteMatch = /^\/users\/([^/]+)\/roles\/([^/]+)$/.exec(path);
    if (userRoleDeleteMatch && req.method === "DELETE") {
      const id = vUuid(userRoleDeleteMatch[1], "id");
      const code = userRoleDeleteMatch[2];
      const updated = await removeRole(actor, id, code);
      return jsonOk(updated, { requestId, cache: "no-store" });
    }

    if (path === "/articles" && req.method === "GET") {
      const { page, limit } = vPagination(url.searchParams);
      const statusParam = url.searchParams.get("status");
      const status = statusParam
        ? vEnum(statusParam, "status", ["draft", "review", "published", "archived"] as const)
        : undefined;
      const result = await listArticles(actor, { page, limit, status });
      return jsonOk(result.rows, { requestId, cache: "no-store" }, { page, limit, total: result.total });
    }

    if (path === "/articles" && req.method === "POST") {
      const body = await req.json();
      const created = await createArticle(actor, body);
      return jsonOk(created, { requestId, cache: "no-store" }, undefined, 201);
    }

    const articleMatch = /^\/articles\/([^/]+)$/.exec(path);
    if (articleMatch) {
      const id = vUuid(articleMatch[1], "id");
      if (req.method === "GET") {
        const row = await getArticle(actor, id);
        return jsonOk(row, { requestId, cache: "no-store" });
      }
      if (req.method === "PATCH") {
        const body = await req.json();
        const updated = await updateArticle(actor, id, body);
        return jsonOk(updated, { requestId, cache: "no-store" });
      }
      if (req.method === "DELETE") {
        await deleteArticle(actor, id);
        return new Response(null, { status: 204, headers: { "x-request-id": requestId } });
      }
    }

    const transitionMatch = /^\/articles\/([^/]+)\/(publish|archive|submit|unarchive|reject)$/.exec(path);
    if (transitionMatch && req.method === "POST") {
      const id = vUuid(transitionMatch[1], "id");
      const action = transitionMatch[2] as ContentAction;
      const updated = await transitionArticle(actor, id, action);
      return jsonOk(updated, { requestId, cache: "no-store" });
    }

    if (path === "/messages" && req.method === "GET") {
      const { page, limit } = vPagination(url.searchParams);
      const statusRaw = url.searchParams.get("status");
      const status = statusRaw ? vEnum(statusRaw, "status", ["new", "read", "replied", "closed"] as const) : undefined;
      const result = await listMessages(actor, { page, limit, status });
      return jsonOk(result.rows, { requestId, cache: "no-store" }, { page, limit, total: result.total });
    }

    const messageMatch = /^\/messages\/([^/]+)$/.exec(path);
    if (messageMatch && req.method === "PATCH") {
      const id = vUuid(messageMatch[1], "id");
      const body = await req.json();
      const updated = await updateMessageStatus(actor, id, body);
      return jsonOk(updated, { requestId, cache: "no-store" });
    }

    const previewCreateMatch = /^\/articles\/([^/]+)\/preview$/.exec(path);
    if (previewCreateMatch && req.method === "POST") {
      const id = vUuid(previewCreateMatch[1], "id");
      const token = await createPreviewToken(actor, id);
      return jsonOk(token, { requestId, cache: "no-store" }, undefined, 201);
    }

    if (path === "/audit-events" && req.method === "GET") {
      if (role !== "admin") throw ApiError.forbidden();
      const { page, limit } = vPagination(url.searchParams);
      const { adminFetchList } = await import("./repository.ts");
      const result = await adminFetchList<Record<string, unknown>>("audit_events", {
        page, limit, order: "occurred_at.desc",
      });
      return jsonOk(result.rows, { requestId, cache: "no-store" }, { page, limit, total: result.total });
    }

    if (path === "/media" && req.method === "GET") {
      const { page, limit } = vPagination(url.searchParams);
      const visibilityRaw = url.searchParams.get("visibility");
      const visibility = visibilityRaw ? vEnum(visibilityRaw, "visibility", ["public", "private", "archive"] as const) : undefined;
      const result = await listMedia(actor, { page, limit, visibility });
      return jsonOk(result.rows, { requestId, cache: "no-store" }, { page, limit, total: result.total });
    }

    if (path === "/media" && req.method === "POST") {
      const body = (await req.json()) as {
        filename?: string;
        contentBase64?: string;
        logicalName?: string;
        mimeType?: string;
        altText?: string;
        isDecorative?: boolean;
        visibility?: string;
        width?: number;
        height?: number;
        caption?: string;
        source?: string;
        license?: string;
        author?: string;
      };
      const filename = vString(body.filename, "filename", { max: 255, required: true });
      const contentBase64 = vString(body.contentBase64, "contentBase64", { max: 14_000_000, required: true });
      const buffer = Buffer.from(contentBase64, "base64");
      const result = await uploadMedia(actor, {
        logicalName: body.logicalName ?? filename,
        mimeType: body.mimeType ?? "application/octet-stream",
        sizeBytes: buffer.length,
        width: body.width ?? null,
        height: body.height ?? null,
        altText: body.altText ?? null,
        isDecorative: body.isDecorative ?? false,
        caption: body.caption ?? null,
        source: body.source ?? null,
        license: body.license ?? null,
        author: body.author ?? null,
        visibility: (body.visibility as "public" | "private" | "archive") ?? "private",
      }, filename, buffer);
      return jsonOk(result, { requestId, cache: "no-store" }, undefined, 201);
    }

    if (path === "/media/orphans" && req.method === "GET") {
      const report = await findOrphanMedia(actor);
      return jsonOk(report, { requestId, cache: "no-store" });
    }

    const mediaMatch = /^\/media\/([^/]+)$/.exec(path);
    if (mediaMatch) {
      const id = vUuid(mediaMatch[1], "id");
      if (req.method === "GET") {
        const { adminFetchList } = await import("./media-repository.ts");
        const row = await adminFetchList<{ id: string }>("media_assets", { page: 1, limit: 1, filters: { id: `eq.${id}` } });
        return jsonOk(row.rows[0] ?? null, { requestId, cache: "no-store" });
      }
      if (req.method === "PATCH") {
        const body = await req.json();
        const updated = await updateMediaMetadata(actor, id, body);
        return jsonOk(updated, { requestId, cache: "no-store" });
      }
      if (req.method === "DELETE") {
        await deleteMedia(actor, id);
        return new Response(null, { status: 204, headers: { "x-request-id": requestId } });
      }
    }

    const signedMatch = /^\/media\/([^/]+)\/signed-url$/.exec(path);
    if (signedMatch && req.method === "POST") {
      const id = vUuid(signedMatch[1], "id");
      const body = (await req.json()) as { expiresIn?: number };
      const result = await createSignedUrl(actor, id, body.expiresIn ?? 3600);
      return jsonOk(result, { requestId, cache: "no-store" });
    }

    const derivedMatch = /^\/media\/([^/]+)\/derivatives$/.exec(path);
    if (derivedMatch && req.method === "GET") {
      const id = vUuid(derivedMatch[1], "id");
      const result = await getDerivedMedia(actor, id);
      return jsonOk(result, { requestId, cache: "no-store" });
    }

    throw ApiError.notFound();
  });
}

export { ApiError };
