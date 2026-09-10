import { test } from "node:test";
import assert from "node:assert/strict";
import { isOkEnvelope, isErrorEnvelope, okMeta } from "../../src/lib/api/envelope.ts";

test("enveloppe succès : data + meta.requestId", () => {
  const e = { data: { id: 1 }, meta: okMeta("r-1") };
  assert.equal(isOkEnvelope(e), true);
});

test("enveloppe succès : invalide sans meta.requestId", () => {
  assert.equal(isOkEnvelope({ data: 1, meta: {} }), false);
  assert.equal(isOkEnvelope({ data: 1, meta: { requestId: "r" } }), false); // version de contrat obligatoire
  assert.equal(isOkEnvelope(null), false);
  assert.equal(isOkEnvelope({ data: 1 }), false);
});

test("meta inclut la pagination", () => {
  const m = okMeta("r-2", { page: 2, limit: 10, total: 21 });
  assert.deepEqual(m, { requestId: "r-2", contractVersion: "1", page: 2, limit: 10, total: 21 });
});

test("enveloppe erreur : code + message + requestId", () => {
  const e = { error: { code: "VALIDATION_ERROR", message: "x" }, meta: { requestId: "r-3" } };
  assert.equal(isErrorEnvelope(e), true);
});

test("enveloppe erreur : invalide sans message", () => {
  assert.equal(isErrorEnvelope({ error: { code: "X" }, meta: { requestId: "r" } }), false);
  assert.equal(isErrorEnvelope({ error: null, meta: {} }), false);
});
