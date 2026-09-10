
export interface RequestLogEntry {
  event: "request";
  requestId: string;
  route: string; // motif de route (sans identifiants personnels)
  method: string;
  status: number;
  latencyMs: number;
  error?: string; // code machine contractuel, jamais le détail interne
}

export function buildRequestLog(entry: RequestLogEntry): string {
  const base = `${entry.method} ${entry.route} ${entry.status} ${entry.latencyMs}ms [${entry.requestId}]`;
  return entry.error ? `${base} error=${entry.error}` : base;
}

/** Journalise sur la sortie standard serveur (jamais envoyée au client). */
export function logRequest(entry: RequestLogEntry): void {
  console.log(buildRequestLog(entry));
}
