import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTransition, canTransition, checkPublishability } from "../../src/lib/api/admin/workflow.ts";
import { createArticle, transitionArticle, deleteArticle, getDashboard } from "../../src/lib/api/admin/service.ts";
import { ApiError } from "../../src/lib/api/errors.ts";

test("transitions : matrice conforme à la matrice des permissions", () => {
  // Éditeur peut soumettre un brouillon, ne peut pas publier
  assert.equal(canTransition("draft", "submit", "editor"), true);
  assert.equal(canTransition("review", "publish", "editor"), false);
  // Admin peut publier
  assert.equal(canTransition("review", "publish", "admin"), true);
  // Relecteur peut rejeter
  assert.equal(canTransition("review", "reject", "reviewer"), true);
  // Lecture seule : rien
  assert.equal(canTransition("draft", "submit", "readonly"), false);
});

test("transitions : publication idempotente, archivage idempotent", () => {
  assert.equal(applyTransition("published", "publish", "admin").next, "published");
  assert.equal(applyTransition("archived", "archive", "admin").next, "archived");
});

test("transitions : transition interdite -> CONFLICT", () => {
  assert.throws(() => applyTransition("draft", "publish", "admin"), (e) => e instanceof ApiError && e.code === "CONFLICT");
  assert.throws(() => applyTransition("published", "submit", "admin"), (e) => e instanceof ApiError && e.code === "CONFLICT");
});

test("transitions : rôle non autorisé -> FORBIDDEN", () => {
  assert.throws(() => applyTransition("review", "publish", "editor"), (e) => e instanceof ApiError && e.code === "FORBIDDEN");
});

test("publishability : couverture manquante -> non publiable", () => {
  const r = checkPublishability({ title: "Ok", excerpt: "Assez long résumé ici", body: [{ t: "p" }], coverMediaId: null });
  assert.equal(r.publishable, false);
  assert.ok(r.reasons.some((x) => x.includes("couverture")));
});

test("publishability : complet -> publiable", () => {
  const r = checkPublishability({ title: "Titre ok", excerpt: "Résumé assez long pour passer", body: [{ t: "p" }], coverMediaId: "uuid" });
  assert.equal(r.publishable, true);
});

test("service : un éditeur ne peut pas supprimer", async () => {
  await assert.rejects(
    deleteArticle({ id: "u1", role: "editor" }, "id"),
    (e) => e instanceof ApiError && e.code === "FORBIDDEN",
  );
});

test("service : création d'article normalise le statut à draft", async () => {
  const inserts: Record<string, unknown>[] = [];
  const created = await createArticle(
    { id: "u1", role: "editor" },
    { type: "article", slug: "mon-slug", title: "Titre", excerpt: "Résumé assez long pour la validation.", body: [{ t: "p" }] },
    { insert: async (_t, b) => { inserts.push(b as Record<string, unknown>); return b as never; } },
  );
  assert.equal(created.status, "draft");
  assert.equal(inserts[0].author_id, "u1");
});

test("service : publication sans couverture -> CONFLICT", async () => {
  await assert.rejects(
    transitionArticle({ id: "u1", role: "admin" }, "id", "publish", {
      fetchOne: async () => ({ id: "id", status: "review", title: "Titre", excerpt: "Résumé assez long pour passer.", body: [], cover_media_id: null }) as never,
    }),
    (e) => e instanceof ApiError && e.code === "CONFLICT",
  );
});

test("service : publication idempotente ne change pas le statut", async () => {
  const result = await transitionArticle({ id: "u1", role: "admin" }, "id", "publish", {
    fetchOne: async () => ({ id: "id", status: "published", title: "Titre", excerpt: "Résumé assez long pour passer.", body: [{ t: "p" }], cover_media_id: "cov" }) as never,
    update: async () => ({ id: "id", status: "published" }) as never,
  });
  assert.equal(result.status, "published");
});

test("service : dashboard interdit au rôle non autorisé", async () => {
  await assert.rejects(
    getDashboard({ id: "u1", role: "readonly" }),
    (e) => e instanceof ApiError && e.code === "FORBIDDEN",
  );
});
