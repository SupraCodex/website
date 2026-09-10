/**
 * Réponses HTTP normalisées : en-têtes de sécurité, enveloppes contractuelles,
 * cache par type de route (dynamique par défaut), CORS non ouvert (same-origin).
 * Les traces internes sont neutralisées : seule la classe d'erreur sort au client.
 */

import { ApiError, toApiError } from "./errors.ts";
import { okMeta, CONTRACT_VERSION, type ApiMeta } from "./envelope.ts";
import { getOrCreateRequestId } from "./request-id.ts";

export interface SecurityHeadersInit {
  requestId: string;
  cache: "no-store" | "private" | "public-short";
}

const BASE_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
};

function cacheHeader(c: SecurityHeadersInit["cache"]): string {
  if (c === "no-store") return "no-store";
  if (c === "private") return "private, max-age=0, must-revalidate";
  return "public, max-age=60, stale-while-revalidate=300";
}

export function jsonOk(
  data: unknown,
  headersInit: SecurityHeadersInit,
  pagination?: { page: number; limit: number; total: number },
  status = 200,
): Response {
  const meta: ApiMeta = okMeta(headersInit.requestId, pagination);
  return new Response(JSON.stringify({ data, meta }), {
    status,
    headers: {
      ...BASE_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheHeader(headersInit.cache),
      "x-request-id": headersInit.requestId,
    },
  });
}

export function jsonError(e: unknown, requestId: string): Response {
  const apiError = toApiError(e);
  const body: { error: { code: string; message: string; details?: unknown }; meta: ApiMeta } = {
    error: { code: apiError.code, message: apiError.message },
    meta: { requestId, contractVersion: CONTRACT_VERSION },
  };
  if (apiError.details) body.error.details = apiError.details;
  return new Response(JSON.stringify(body), {
    status: apiError.status,
    headers: {
      ...BASE_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}

/** Handler générique de route : request ID + erreur contractuelle systématiques. */
export async function handleRoute(req: Request, fn: (requestId: string) => Promise<Response>): Promise<Response> {
  const requestId = getOrCreateRequestId(req.headers.get("x-request-id"));
  try {
    return await fn(requestId);
  } catch (e: unknown) {
    return jsonError(e, requestId);
  }
}

export { ApiError };
