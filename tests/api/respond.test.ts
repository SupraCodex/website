import { test } from "node:test";
import assert from "node:assert/strict";
import { getOrCreateRequestId } from "../../src/lib/api/request-id.ts";
import { jsonOk, jsonError, handleRoute } from "../../src/lib/api/respond.ts";
import { ApiError } from "../../src/lib/api/errors.ts";
import { buildRequestLog } from "../../src/lib/api/logger.ts";

test("request id : réutilise l'entrant sain, sinon génère", () => {
  assert.equal(getOrCreateRequestId("abc-123_XY.9"), "abc-123_XY.9");
  assert.equal(getOrCreateRequestId("x".repeat(65)).length, 36); // trop long -> uuid
  assert.equal(getOrCreateRequestId("<script>").length, 36); // caractère interdit -> uuid
  assert.equal(getOrCreateRequestId(null).length, 36);
  assert.notEqual(getOrCreateRequestId(null), getOrCreateRequestId(null));
});

test("jsonOk : en-têtes de sécurité + enveloppe", async () => {
  const res = jsonOk({ a: 1 }, { requestId: "r-1", cache: "no-store" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-request-id"), "r-1");
  const body = (await res.json()) as { data: unknown; meta: { requestId: string } };
  assert.deepEqual(body.data, { a: 1 });
  assert.equal(body.meta.requestId, "r-1");
});

test("jsonOk : cache public court pour routes stables", () => {
  const res = jsonOk([], { requestId: "r", cache: "public-short" });
  assert.match(res.headers.get("cache-control") ?? "", /^public, max-age=60/);
});

test("jsonError : statut et code contractuels, pas de détail interne", async () => {
  const res = jsonError(new Error("stack interne confidentielle"), "r-2");
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(body.error.message.includes("confidentielle"), false);
});

test("handleRoute : convertit ApiError et propage le request ID", async () => {
  const req = new Request("https://x.test/api/v1/thing", { headers: { "x-request-id": "req-9" } });
  const res = await handleRoute(req, () => Promise.reject(ApiError.notFound()));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("x-request-id"), "req-9");
  const body = (await res.json()) as { meta: { requestId: string } };
  assert.equal(body.meta.requestId, "req-9");
});

test("handleRoute : succès", async () => {
  const req = new Request("https://x.test/api/v1/thing");
  const res = await handleRoute(req, async (rid) => jsonOk({ ok: true }, { requestId: rid, cache: "no-store" }));
  assert.equal(res.status, 200);
});

test("journal : ligne minimisée sans donnée personnelle", () => {
  const line = buildRequestLog({ event: "request", requestId: "r-1", route: "/api/v1/articles", method: "GET", status: 200, latencyMs: 12 });
  assert.match(line, /GET \/api\/v1\/articles 200 12ms \[r-1\]/);
  const lineErr = buildRequestLog({ event: "request", requestId: "r-2", route: "/api/v1/x", method: "POST", status: 429, latencyMs: 3, error: "RATE_LIMITED" });
  assert.match(lineErr, /error=RATE_LIMITED$/);
});
