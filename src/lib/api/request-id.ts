/**
 * Identifiant de corrélation par requête : réutilise x-request-id entrant
 * (longueur bornée) sinon en génère un. Jamais de donnée personnelle dedans.
 */

const MAX_INBOUND_LEN = 64;

export function getOrCreateRequestId(inbound: string | null | undefined): string {
  const v = (inbound ?? "").trim();
  if (v && v.length <= MAX_INBOUND_LEN && /^[\w.-]+$/.test(v)) return v;
  return crypto.randomUUID();
}
