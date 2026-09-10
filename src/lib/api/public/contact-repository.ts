
import { getConfig } from "../auth.ts";
import { hashIdentity } from "../rate-limit.ts";
import type { ContactInput } from "./contact-validate.ts";

function serviceHeaders(): Record<string, string> {
  const cfg = getConfig();
  return { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}`, "content-type": "application/json" };
}

export interface StoredContact {
  id: string;
  receivedAt: string;
}

/** Construit le payload d'insertion : honeypot vide, source_ip = empreinte non réversible. */
export function buildContactPayload(input: ContactInput, identity: string): Record<string, unknown> {
  return {
    name: input.name,
    email: input.email,
    subject: input.sujet,
    message: input.message,
    website: "", // honeypot : jamais persisté tel quel
    source_ip: hashIdentity(identity), // empreinte non réversible, pas d'IP en clair
  };
}

/** Insère le message (service_role, contourne RLS côté serveur de confiance). */
export async function insertContactMessage(input: ContactInput, identity: string, _requestId: string): Promise<StoredContact> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/contact_messages`, {
    method: "POST",
    headers: { ...serviceHeaders(), prefer: "return=representation" },
    body: JSON.stringify(buildContactPayload(input, identity)),
  });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const row = (await res.json()) as { id: string; received_at: string }[];
  return { id: row[0].id, receivedAt: row[0].received_at };
}

export type ContactAuditResult = "accepted" | "rate_limited" | "invalid" | "email_unavailable";

/** Journal minimal sans données personnelles (migration 0014). */
export async function logContactAudit(event: string, result: ContactAuditResult, identity: string, requestId: string): Promise<void> {
  try {
    const cfg = getConfig();
    await fetch(`${cfg.supabaseUrl}/rest/v1/contact_audit_events`, {
      method: "POST",
      headers: { ...serviceHeaders(), prefer: "return=minimal" },
      body: JSON.stringify({
        event,
        result,
        identity_hash: identity ? hashIdentity(identity) : null,
        request_id: requestId,
      }),
    });
  } catch {
    // Le journal ne doit jamais faire échouer la réponse utilisateur.
  }
}
