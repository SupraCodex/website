import { netTest } from "../helpers/net.ts";
import assert from "node:assert/strict";
import { handleAdminApi } from "../../src/lib/api/admin/router.ts";
import { getConfig } from "../../src/lib/api/auth.ts";
import "../helpers/load-env.ts";

const BASE = "https://api.test/api/v1/admin";

netTest("admin : accès sans jeton -> 401 UNAUTHENTICATED", async () => {
  const res = await handleAdminApi(new Request(`${BASE}/dashboard`));
  assert.equal(res.status, 401);
  const b = (await res.json()) as { error: { code: string } };
  assert.equal(b.error.code, "UNAUTHENTICATED");
});

netTest("admin : accès avec jeton invalide -> 401", async () => {
  const res = await handleAdminApi(new Request(`${BASE}/articles`, {
    headers: { authorization: "Bearer jeton-invalide-12345" },
  }));
  assert.equal(res.status, 401);
  const b = (await res.json()) as { error: { code: string } };
  assert.equal(b.error.code, "UNAUTHENTICATED");
});

netTest("admin : accès avec clé anon (pas une session) -> 401 UNAUTHENTICATED", async () => {
  // La clé anon n'est pas un jeton d'accès utilisateur : Supabase Auth la refuse.
  const cfg = getConfig();
  const res = await handleAdminApi(new Request(`${BASE}/dashboard`, {
    headers: { authorization: `Bearer ${cfg.anonKey}` },
  }));
  assert.equal(res.status, 401);
  const b = (await res.json()) as { error: { code: string } };
  assert.equal(b.error.code, "UNAUTHENTICATED");
});

netTest("admin : route inconnue sans auth -> 401 (auth vérifiée avant résolution)", async () => {
  // Le bearer est requis avant toute résolution de route : 401, pas 404.
  const res = await handleAdminApi(new Request(`${BASE}/inconnu`));
  assert.equal(res.status, 401);
});

netTest("admin : GET /articles sans session -> 401", async () => {
  const res = await handleAdminApi(new Request(`${BASE}/articles`));
  assert.equal(res.status, 401);
});
