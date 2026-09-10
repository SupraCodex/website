import { netTest } from "../helpers/net.ts";
import assert from "node:assert/strict";
import { handlePublicApi } from "../../src/lib/api/public/router.ts";
import { getConfig } from "../../src/lib/api/auth.ts";
import "../helpers/load-env.ts";

const BASE = "https://api.test/api/v1";
const VALIDATION_EMAIL = `validation+${Date.now()}@example.invalid`;

netTest("POST /contact-messages (réseau réel) -> 202 + ligne en base + cache no-store", async () => {
  const res = await handlePublicApi(new Request(`${BASE}/contact-messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify({
      name: "Visiteur de validation",
      email: VALIDATION_EMAIL,
      sujet: "Test contact integration",
      message: "Message de validation d’intégration — à supprimer.",
      website: "",
    }),
  }));
  assert.equal(res.status, 202);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const b = (await res.json()) as { data: { received: boolean }; meta: { requestId: string } };
  assert.equal(b.data.received, true);
  assert.ok(b.meta.requestId);

  // Vérification en base via service (jamais via anon : RLS interdit la lecture).
  const cfg = getConfig();
  const svc = await fetch(`${cfg.supabaseUrl}/rest/v1/contact_messages?email=eq.${encodeURIComponent(VALIDATION_EMAIL)}&select=id,subject,status`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  assert.equal(svc.status, 200);
  const rows = (await svc.json()) as { id: string; subject: string; status: string }[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "new");

  // Nettoyage : suppression de la donnée de validation.
  const del = await fetch(`${cfg.supabaseUrl}/rest/v1/contact_messages?id=eq.${rows[0].id}`, {
    method: "DELETE",
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  assert.ok(del.status === 204 || del.status === 200);
});

netTest("POST /contact-messages avec honeypot rempli (réseau réel) -> 202 neutre, rien en base", async () => {
  const stamp = `hp-${Date.now()}`;
  const res = await handlePublicApi(new Request(`${BASE}/contact-messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Bot de validation", email: "bot@example.invalid", sujet: "Spam de validation", message: "Message de bot de validation.", website: "http://spam" }),
  }));
  assert.equal(res.status, 202);
  const cfg = getConfig();
  const svc = await fetch(`${cfg.supabaseUrl}/rest/v1/contact_messages?subject=eq.Spam%20de%20validation&select=id`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  const rows = (await svc.json()) as unknown[];
  assert.equal(rows.length, 0);
  assert.ok(stamp); // marqueur de lisibilité
});

netTest("POST /contact-messages invalide (réseau réel) -> 422", async () => {
  const res = await handlePublicApi(new Request(`${BASE}/contact-messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x", email: "non", sujet: "", message: "court" }),
  }));
  assert.equal(res.status, 422);
  const b = (await res.json()) as { error: { code: string; details?: { field: string }[] } };
  assert.equal(b.error.code, "VALIDATION_ERROR");
  assert.ok((b.error.details ?? []).length >= 3);
});

netTest("GET /contact-messages (réseau réel) -> 404 : lecture publique interdite", async () => {
  const res = await handlePublicApi(new Request(`${BASE}/contact-messages`));
  assert.equal(res.status, 404);
});
