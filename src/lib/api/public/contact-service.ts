
import { ApiError } from "../errors.ts";
import { okMeta } from "../envelope.ts";
import { enforceRateLimit } from "../rate-limit.ts";
import { logRequest, type RequestLogEntry } from "../logger.ts";
import { getEmailProvider } from "../email/provider.ts";
import { validateContact, type ContactInput } from "./contact-validate.ts";
import { insertContactMessage, logContactAudit } from "./contact-repository.ts";

export interface ContactOutcome {
  /** Réponse HTTP à renvoyer (toujours 202, corps générique). */
  status: number;
  body: { data: { received: true }; meta: ReturnType<typeof okMeta> };
}

/** Construit l'e-mail de confirmation générique (sans reprise des données saisies). */
export function buildConfirmationEmail(input: ContactInput, requestId: string): Parameters<ReturnType<typeof getEmailProvider>["send"]>[0] {
  return {
    to: input.email,
    subject: "Nous avons bien reçu votre message",
    textBody:
      "Bonjour,\n\nNous avons bien reçu votre message et vous répondrons dans les meilleurs délais.\n\n" +
      "Ceci est un message automatique : merci de ne pas y répondre.\n",
    requestId,
  };
}

export interface ContactDeps {
  enforce?: typeof enforceRateLimit;
  insert?: typeof insertContactMessage;
  audit?: typeof logContactAudit;
  email?: ReturnType<typeof getEmailProvider>;
}

/** Traite une soumission de contact (dépendances injectables pour les tests). */
export async function handleContactSubmission(
  body: unknown,
  identity: string,
  requestId: string,
  deps: ContactDeps = {},
): Promise<ContactOutcome> {
  const enforce = deps.enforce ?? enforceRateLimit;
  const insert = deps.insert ?? insertContactMessage;
  const audit = deps.audit ?? logContactAudit;
  const provider = deps.email ?? getEmailProvider();

  // 1. Validation (422 avec détails de champs).
  let input: ContactInput;
  try {
    input = validateContact(body);
  } catch (e) {
    await audit("contact_submit", "invalid", identity, requestId);
    throw e;
  }

  // 2. Honeypot : réponse neutre identique (l'abus ne sait pas s'il a été filtré).
  if (input.website !== "") {
    await audit("contact_submit", "accepted", identity, requestId);
    return { status: 202, body: { data: { received: true }, meta: okMeta(requestId) } };
  }

  try {
    enforce(identity);
  } catch (e) {
    await audit("contact_submit", "rate_limited", identity, requestId);
    throw e; // ApiError RATE_LIMITED (429), message générique
  }

  // 4. Insertion atomique + 5. e-mail + 6. journal.
  try {
    await insert(input, identity, requestId);
  } catch (e) {
    await audit("contact_submit", "invalid", identity, requestId);
    throw e instanceof ApiError ? e : ApiError.internal();
  }

  // L'échec e-mail ne bloque PAS la réception du message : file + reprise documentée.
  try {
    await provider.send(buildConfirmationEmail(input, requestId));
    await audit("contact_confirm", "accepted", identity, requestId);
  } catch {
    await audit("contact_confirm", "email_unavailable", identity, requestId);
  }

  const log: RequestLogEntry = {
    event: "request", requestId, route: "/api/v1/contact-messages", method: "POST",
    status: 202, latencyMs: 0,
  };
  logRequest(log);

  return { status: 202, body: { data: { received: true }, meta: okMeta(requestId) } };
}

export { ApiError };
