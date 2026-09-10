import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit, resetRateLimit, hashIdentity, CONTACT_RULES } from "../../src/lib/api/rate-limit.ts";
import { ApiError } from "../../src/lib/api/errors.ts";

test("empreinte d'identité : déterministe, non réversible", () => {
  assert.equal(hashIdentity("203.0.113.9"), hashIdentity("203.0.113.9"));
  assert.notEqual(hashIdentity("203.0.113.9"), "203.0.113.9");
  assert.match(hashIdentity("203.0.113.9"), /^[0-9a-f]+$/);
});

test("contact : 5 autorisées sur 15 min, la 6e est limitée", () => {
  resetRateLimit();
  for (let i = 0; i < 5; i++) enforceRateLimit("203.0.113.10");
  try {
    enforceRateLimit("203.0.113.10");
    assert.fail("devait lever RATE_LIMITED");
  } catch (e) {
    assert.ok(e instanceof ApiError);
    assert.equal(e.code, "RATE_LIMITED");
    assert.equal(e.status, 429);
  }
});

test("contact : une autre IP n'est pas impactée", () => {
  resetRateLimit();
  for (let i = 0; i < 5; i++) enforceRateLimit("203.0.113.20");
  enforceRateLimit("203.0.113.21"); // ne doit pas lever
});

test("contact : fenêtre glissante (le temps s'écoule -> autorisé)", () => {
  resetRateLimit();
  const t = Date.now();
  for (let i = 0; i < 5; i++) enforceRateLimit("203.0.113.30", CONTACT_RULES, t);
  enforceRateLimit("203.0.113.30", CONTACT_RULES, t + 16 * 60 * 1000); // fenêtre expirée
});

test("plafond horaire indépendant (20/heure)", () => {
  resetRateLimit();
  let step = 0;
  for (; step < 5; step++) enforceRateLimit("203.0.113.40", [CONTACT_RULES[1]], Date.now() + step * 60_000);
  assert.equal(step, 5);
});
