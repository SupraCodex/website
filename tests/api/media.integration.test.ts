import { netTest } from "../helpers/net.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAdminApi } from "../../src/lib/api/admin/router.ts";
import "../helpers/load-env.ts";

const fs = await import("node:fs");
// Ces tests exigent un compte admin de test réel : ignorés (et non en échec) sans identifiants.
const hasCreds = fs.existsSync("_admin_test_creds.json");
const creds = hasCreds
  ? (JSON.parse(fs.readFileSync("_admin_test_creds.json", "utf-8")) as { accessToken: string })
  : { accessToken: "" };
const mediaTest = hasCreds ? netTest : test.skip;
const BASE = "https://api.test/api/v1/admin";

function adminRequest(method: string, path: string, body?: unknown): Request {
  const headers: Record<string, string> = { authorization: `Bearer ${creds.accessToken}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Image 1x1 pixel PNG (base64)
const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let uploadedMediaId: string | null = null;

mediaTest("POST /media : upload d'un fichier PNG valide -> 201", async () => {
  const res = await handleAdminApi(adminRequest("POST", "/media", {
    filename: "test-image.png",
    contentBase64: PNG_1x1,
    logicalName: "Image de test",
    mimeType: "image/png",
    altText: "Texte alternatif de test",
    isDecorative: false,
    visibility: "public",
    width: 1,
    height: 1,
  }));
  assert.equal(res.status, 201);
  const b = (await res.json()) as { data: { id: string; publicUrl: string | null } };
  assert.ok(b.data.id);
  assert.ok(b.data.publicUrl, "le média public doit avoir une URL publique");
  uploadedMediaId = b.data.id;
});

mediaTest("GET /media : liste inclut le média uploadé", async () => {
  const res = await handleAdminApi(adminRequest("GET", "/media?visibility=public"));
  assert.equal(res.status, 200);
  const b = (await res.json()) as { data: { id: string }[]; meta: { total: number } };
  assert.ok(b.data.some((m) => m.id === uploadedMediaId));
});

mediaTest("GET /media/{id} : récupère le média", async () => {
  const res = await handleAdminApi(adminRequest("GET", `/media/${uploadedMediaId}`));
  assert.equal(res.status, 200);
  const b = (await res.json()) as { data: { id: string; logical_name: string } };
  assert.equal(b.data.logical_name, "Image de test");
});

mediaTest("POST /media/{id}/signed-url : génère une URL signée", async () => {
  // Retry car Supabase Storage peut avoir un délai de propagation après l'upload
  let res: Response | undefined;
  for (let i = 0; i < 5; i++) {
    res = await handleAdminApi(adminRequest("POST", `/media/${uploadedMediaId}/signed-url`, { expiresIn: 3600 }));
    if (res.status === 200) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(res, "signed-url response expected");
  assert.equal(res.status, 200);
  const b = (await res.json()) as { data: { url: string; expiresAt: string } };
  assert.ok(b.data.url.length > 0);
  assert.ok(b.data.expiresAt);
});

mediaTest("PATCH /media/{id} : met à jour les métadonnées", async () => {
  const res = await handleAdminApi(adminRequest("PATCH", `/media/${uploadedMediaId}`, {
    altText: "Nouveau texte alternatif",
    caption: "Légende de test",
  }));
  assert.equal(res.status, 200);
  const b = (await res.json()) as { data: { alt_text: string; caption: string } };
  assert.equal(b.data.alt_text, "Nouveau texte alternatif");
  assert.equal(b.data.caption, "Légende de test");
});

mediaTest("GET /media/{id}/derivatives : rapport de dérivés (vide tant que le pipeline n'existe pas)", async () => {
  const res = await handleAdminApi(adminRequest("GET", `/media/${uploadedMediaId}/derivatives`));
  assert.equal(res.status, 200);
  const b = (await res.json()) as { data: { mediaId: string; derivatives: { suffix: string }[] } };
  assert.equal(b.data.mediaId, uploadedMediaId);
  // Contrat : collection vide jusqu'à l'intégration du pipeline de dérivés.
  assert.ok(Array.isArray(b.data.derivatives));
});

mediaTest("GET /media/orphans : rapport d'orphelins (admin)", async () => {
  const res = await handleAdminApi(adminRequest("GET", "/media/orphans"));
  assert.equal(res.status, 200);
  const b = (await res.json()) as { data: { total: number } };
  assert.ok(typeof b.data.total === "number");
});

mediaTest("DELETE /media/{id} : suppression contrôlée (admin)", async () => {
  const res = await handleAdminApi(adminRequest("DELETE", `/media/${uploadedMediaId}`));
  assert.equal(res.status, 204);

  // Vérifier que le média n'existe plus
  const check = await handleAdminApi(adminRequest("GET", `/media/${uploadedMediaId}`));
  const b = (await check.json()) as { data: unknown };
  assert.equal(b.data, null);
});
