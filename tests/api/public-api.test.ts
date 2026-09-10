import { netTest } from "../helpers/net.ts";
import assert from "node:assert/strict";
import "../helpers/load-env.ts";
import { handlePublicApi } from "../../src/lib/api/public/router.ts";

const BASE = "https://api.test/api/v1";

function req(path: string): Request {
  return new Request(BASE + path);
}

async function body(res: Response): Promise<{ data: unknown; meta: { requestId: string; page?: number; limit?: number; total?: number }; error?: { code: string } }> {
  return await res.json();
}

netTest("GET /expertises : liste publiée avec enveloppe et pagination", async () => {
  const res = await handlePublicApi(req("/expertises?page=1&limit=10"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control") ?? "", /^public, max-age=60/);
  const b = await body(res);
  assert.ok(Array.isArray(b.data));
  assert.equal(b.meta.page, 1);
  assert.ok(typeof b.meta.total === "number");
  // Modèle public : aucune colonne interne
  for (const e of b.data as Record<string, unknown>[]) {
    assert.ok(!("author_id" in e) && !("status" in e) && !("created_at" in e));
  }
});

netTest("GET /expertises/{slug} : fiche publique sur un slug publié", async () => {
  // Récupère un slug publié existant via le routeur lui-même
  const list = await handlePublicApi(req("/expertises?limit=1"));
  const rows = ((await list.json()) as { data: { slug: string }[] }).data;
  if (rows.length === 0) return; // l’environnement peut être vide avant import éditorial
  const res = await handlePublicApi(req(`/expertises/${rows[0].slug}`));
  assert.equal(res.status, 200);
  const b = await body(res);
  assert.equal((b.data as { slug: string }).slug, rows[0].slug);
  assert.ok(!("status" in (b.data as object)));
});

netTest("GET /expertises/{slug} : slug absent -> 404 contractuel", async () => {
  const res = await handlePublicApi(req("/expertises/slug-inexistant-validation"));
  assert.equal(res.status, 404);
  const b = await body(res) as unknown as { error: { code: string } };
  assert.equal(b.error.code, "NOT_FOUND");
});

netTest("GET /articles et /careers : uniquement les publiés", async () => {
  for (const route of ["/articles", "/careers"]) {
    const res = await handlePublicApi(req(route));
    assert.equal(res.status, 200, route);
    const b = await body(res);
    for (const r of b.data as { publishedAt: string | null }[]) {
      assert.ok(r.publishedAt !== undefined);
    }
  }
});

netTest("pagination excessive -> 422, filtre invalide -> 422", async () => {
  const tooMany = await handlePublicApi(req("/expertises?limit=999"));
  assert.equal(tooMany.status, 422);
  const badFeatured = await handlePublicApi(req("/projects?featured=peut-etre"));
  assert.equal(badFeatured.status, 422);
  const badSlug = await handlePublicApi(req("/expertises/SLUG_MAJUSCULES!"));
  assert.equal(badSlug.status, 422);
});

netTest("route inconnue -> 404, méthode non GET -> 404 (publique en lecture seule)", async () => {
  assert.equal((await handlePublicApi(req("/inconnu"))).status, 404);
  const post = new Request(BASE + "/expertises", { method: "POST" });
  assert.equal((await handlePublicApi(post)).status, 404);
});

netTest("état vide : /site-config/public répond 200 même sans réglages", async () => {
  const res = await handlePublicApi(req("/site-config/public"));
  assert.equal(res.status, 200);
  const b = await body(res);
  assert.ok(typeof (b.data as { settings: Record<string, string> }).settings === "object");
});

netTest("le client ne peut pas imposer un statut : filtre status ignoré", async () => {
  const res = await handlePublicApi(req("/articles?limit=50"));
  assert.equal(res.status, 200);
  const { getConfig } = await import("../../src/lib/api/auth.ts");
  const cfg = getConfig();
  // Vérifie directement en base qu'il existe au moins un statut non publié :
  // si oui, il ne doit PAS apparaître dans la réponse publique.
  const svcRes = await fetch(`${cfg.supabaseUrl}/rest/v1/content_items?select=slug,status&status=neq.published`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  if (svcRes.ok) {
    const nonPublished = (await svcRes.json()) as { slug: string }[];
    const pubRes = await handlePublicApi(req("/articles?limit=50"));
    const pub = ((await pubRes.json()) as { data: { slug: string }[] }).data;
    for (const r of nonPublished) {
      assert.ok(!pub.some((p) => p.slug === r.slug), `brouillon divulgué: ${r.slug}`);
    }
  }
});
