
export interface OutgoingEmail {
  to: string;
  subject: string;
  textBody: string;
  /** Référence de corrélation (request ID), pas de données personnelles. */
  requestId: string;
}

export interface EmailSendResult {
  queued: boolean;
  providerId: string | null;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<EmailSendResult>;
}

/** File d'attente mémoire de l'adaptateur local (inspection en tests). */
const localQueue: OutgoingEmail[] = [];

/**
 * Adaptateur local : journalise et met en file, n'envoie rien.
 * Sert aussi de référence pour la reprise : en production, la file serait
 * persistée (table outbox) puis rejouée par une Edge Function.
 */
export const localEmailProvider: EmailProvider = {
  name: "local",
  async send(email) {
    localQueue.push({ ...email });
    console.log(`[email:local] file=${localQueue.length} vers=<masqué> req=${email.requestId}`);
    return { queued: true, providerId: `local-${Date.now()}` };
  },
};

/** Adaptateur indisponible : simule une panne fournisseur (tests de résilience). */
export const unavailableEmailProvider: EmailProvider = {
  name: "unavailable",
  async send() {
    throw new Error("provider_unavailable");
  },
};

/** Sélectionne le fournisseur selon la configuration (local tant que non confirmé). */
export function getEmailProvider(_env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): EmailProvider {
  // La bascule future se fera ici, derrière un flag documenté et daté.
  return localEmailProvider;
}

/** Vide la file locale (tests uniquement). */
export function resetLocalEmailQueue(): void {
  localQueue.length = 0;
}

/** File locale (tests uniquement). */
export function getLocalEmailQueue(): readonly OutgoingEmail[] {
  return localQueue;
}
