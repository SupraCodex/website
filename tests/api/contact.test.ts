import { test } from "node:test";
import assert from "node:assert/strict";
import { handleContactSubmission, buildConfirmationEmail } from "../../src/lib/api/public/contact-service.ts";
import { validateContact, CONTACT_LIMITS } from "../../src/lib/api/public/contact-validate.ts";
import { ApiError } from "../../src/lib/api/errors.ts";
import { localEmailProvider, unavailableEmailProvider, getLocalEmailQueue, resetLocalEmailQueue } from "../../src/lib/api/email/provider.ts";

const VALID = { name: "Visiteur de validation", email: "visiteur@example.invalid", sujet: "Demande d’information", message: "Bonjour, ceci est un message de validation suffisamment long.", website: "" };

function fakeInsert() {
  const calls: unknown[] = [];
  return {
    calls,
    async insert(input: unknown, _identity: string, _rid: string) {
      calls.push(input);
      return { id: "00000000-0000-0000-0000-000000000001", receivedAt: new Date().toISOString() };
    },
  };
}

function fakeAudit() {
  const entries: { event: string; result: string }[] = [];
  return {
    entries,
    audit: async (event: string, result: string) => {
      entries.push({ event, result });
    },
  };
}

test("message valide -> 202 générique + e-mail mis en file + audit accepted", async () => {
  resetLocalEmailQueue();
  const ins = fakeInsert();
  const aud = fakeAudit();
  const out = await handleContactSubmission({ ...VALID }, "203.0.113.1", "req-t1", { insert: ins.insert, audit: aud.audit, email: localEmailProvider });
  assert.equal(out.status, 202);
  assert.deepEqual(out.body.data, { received: true });
  assert.equal(ins.calls.length, 1);
  assert.equal(aud.entries[0].result, "accepted");
  const queue = getLocalEmailQueue();
  assert.equal(queue.length, 1);
  // La confirmation ne reprend aucune donnée saisie
  assert.equal(queue[0].textBody.includes(VALID.message), false);
  assert.equal(queue[0].textBody.includes(VALID.name), false);
});

test("champ invalide -> 422 avec détails, rien inséré, audit invalid", async () => {
  const ins = fakeInsert();
  const aud = fakeAudit();
  await assert.rejects(
    () => handleContactSubmission({ ...VALID, email: "pas-un-email" }, "203.0.113.2", "req-t2", { insert: ins.insert, audit: aud.audit }),
    (e: unknown) => e instanceof ApiError && e.status === 422 && e.details?.some((d) => d.field === "email"),
  );
  assert.equal(ins.calls.length, 0);
  assert.equal(aud.entries[0].result, "invalid");
});

test("honeypot rempli -> 202 neutre, rien inséré, aucune fuite de distinction", async () => {
  const ins = fakeInsert();
  const aud = fakeAudit();
  const out = await handleContactSubmission({ ...VALID, website: "http://spam.example" }, "203.0.113.3", "req-t3", { insert: ins.insert, audit: aud.audit });
  assert.equal(out.status, 202); // même statut que le succès
  assert.equal(ins.calls.length, 0);
  assert.deepEqual(out.body.data, { received: true });
});

test("abus -> 429 RATE_LIMITED après 5 soumissions, audit rate_limited", async () => {
  resetLocalEmailQueue();
  const ins = fakeInsert();
  const aud = fakeAudit();
  const identity = "203.0.113.66";
  for (let i = 0; i < 5; i++) {
    await handleContactSubmission({ ...VALID, email: `v${i}@example.invalid` }, identity, `req-ab${i}`, { insert: ins.insert, audit: aud.audit });
  }
  await assert.rejects(
    () => handleContactSubmission(VALID, identity, "req-ab-x", { insert: ins.insert, audit: aud.audit }),
    (e: unknown) => e instanceof ApiError && e.code === "RATE_LIMITED" && e.status === 429,
  );
  assert.equal(aud.entries.at(-1)?.result, "rate_limited");
});

test("fournisseur indisponible -> message quand même reçu (202), audit email_unavailable", async () => {
  const ins = fakeInsert();
  const aud = fakeAudit();
  const out = await handleContactSubmission(VALID, "203.0.113.90", "req-p1", { insert: ins.insert, audit: aud.audit, email: unavailableEmailProvider });
  assert.equal(out.status, 202);
  assert.equal(ins.calls.length, 1);
  assert.equal(aud.entries.some((e) => e.result === "email_unavailable"), true);
});

test("insertion en échec -> 500 contractuel sans détail interne", async () => {
  const aud = fakeAudit();
  const badInsert = async () => {
    throw new Error("détail SQL confidentiel");
  };
  await assert.rejects(
    () => handleContactSubmission(VALID, "203.0.113.91", "req-p2", { insert: badInsert as never, audit: aud.audit }),
    (e: unknown) => e instanceof ApiError && e.code === "INTERNAL_ERROR" && !e.message.includes("SQL"),
  );
});

test("aucune donnée personnelle superflue : source_ip = empreinte, pas l'IP", async () => {
  const { buildContactPayload } = await import("../../src/lib/api/public/contact-repository.ts");
  const payload = buildContactPayload(validateContact(VALID), "203.0.113.42") as { source_ip: string; website: string };
  assert.notEqual(payload.source_ip, "203.0.113.42");
  assert.match(payload.source_ip, /^[0-9a-f]+$/);
  assert.equal(payload.website, "");
});

test("validateContact : bornes et normalisation", () => {
  const ok = validateContact({ ...VALID, name: "  A B  " });
  assert.equal(ok.name, "A B");
  assert.throws(() => validateContact({ ...VALID, message: "court" }), ApiError);
  assert.throws(() => validateContact({ ...VALID, sujet: "x".repeat(CONTACT_LIMITS.sujet.max + 1) }), ApiError);
});

test("e-mail de confirmation : générique et corrélé au request ID", () => {
  const mail = buildConfirmationEmail(validateContact(VALID), "req-c1");
  assert.equal(mail.requestId, "req-c1");
  assert.equal(mail.textBody.includes(VALID.email), false);
});
