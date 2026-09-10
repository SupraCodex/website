import { netTest } from "../helpers/net.ts";
import assert from "node:assert/strict";
import { getConfig } from "../../src/lib/api/auth.ts";

netTest("config : variables présentes et format d'URL projet valide", () => {
  const cfg = getConfig();
  assert.match(cfg.supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  assert.ok(cfg.anonKey.length >= 20);
  assert.ok(cfg.serviceRoleKey.length >= 20);
});

netTest("contrat : /auth/v1/user sans jeton -> 401 (réseau réel)", async () => {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: cfg.anonKey },
  });
  assert.equal(res.status, 401);
});

netTest("contrat : clé service acceptée par PostgREST (réseau réel)", async () => {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  assert.equal(res.status, 200);
});

netTest("contrat : anon sans jeton refusé par PostgREST (réseau réel)", async () => {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
  });
  assert.equal(res.status, 401);
});

netTest("état en ligne : contenu accessible avec la clé service (200 ou 404 avant migration)", async () => {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/content_items?select=id&limit=1`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  // 404 = la relation n'existe pas encore : migrations 0001..0009 non appliquées en ligne.
  assert.ok([200, 404].includes(res.status), `statut inattendu ${res.status}`);
});
