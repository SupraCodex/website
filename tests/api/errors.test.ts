import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, toApiError } from "../../src/lib/api/errors.ts";

test("codes -> statuts conformes au contrat", () => {
  assert.equal(ApiError.validation("x").status, 422);
  assert.equal(ApiError.unauthenticated().status, 401);
  assert.equal(ApiError.forbidden().status, 403);
  assert.equal(ApiError.notFound().status, 404);
  assert.equal(ApiError.conflict("x").status, 409);
  assert.equal(ApiError.rateLimited().status, 429);
  assert.equal(ApiError.internal().status, 500);
});

test("la validation porte ses détails de champ", () => {
  const e = ApiError.validation("Requête invalide.", [{ field: "email", issue: "adresse invalide" }]);
  assert.deepEqual(e.details, [{ field: "email", issue: "adresse invalide" }]);
});

test("une erreur interne ne fuit pas son détail d'origine", () => {
  const e = toApiError(new Error("detail SQL super secret: select * from profiles"));
  assert.equal(e.code, "INTERNAL_ERROR");
  assert.equal(e.message, "Erreur interne.");
  assert.equal(e.message.includes("SQL"), false);
});

test("toApiError conserve une ApiError déjà contractuelle", () => {
  const original = ApiError.forbidden();
  assert.equal(toApiError(original), original);
});
