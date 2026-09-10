
export const CONTRACT_VERSION = "1";

export interface ApiMeta {
  requestId: string;
  contractVersion?: string;
  page?: number;
  limit?: number;
  total?: number;
  [k: string]: unknown;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export function okMeta(requestId: string, pagination?: { page: number; limit: number; total: number }): ApiMeta {
  return pagination
    ? { requestId, contractVersion: CONTRACT_VERSION, page: pagination.page, limit: pagination.limit, total: pagination.total }
    : { requestId, contractVersion: CONTRACT_VERSION };
}

/** Vérifie qu'un objet respecte la forme de l'enveloppe de succès. */
export function isOkEnvelope(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  const meta = e.meta as ApiMeta | undefined;
  return "data" in e && "meta" in e && typeof meta?.requestId === "string" && typeof meta?.contractVersion === "string";
}

/** Vérifie qu'un objet respecte la forme de l'enveloppe d'erreur. */
export function isErrorEnvelope(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  const err = e.error as ApiErrorBody | undefined;
  return (
    typeof err?.code === "string" &&
    typeof err?.message === "string" &&
    typeof (e.meta as ApiMeta | undefined)?.requestId === "string"
  );
}
