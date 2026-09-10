/**
 * Erreurs contractuelles — codes et statuts alignés sur docs/api/openapi.yaml
 * (400/422 validation, 401 authentification, 403 autorisation, 404 absent,
 * 409 conflit, 429 rate limit, 500 interne).
 * Les messages sont génériques : aucune trace interne ni donnée personnelle.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: { field: string; issue: string }[];

  constructor(code: ApiErrorCode, message: string, details?: { field: string; issue: string }[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static validation(message: string, details?: { field: string; issue: string }[]): ApiError {
    return new ApiError("VALIDATION_ERROR", message, details);
  }
  static unauthenticated(): ApiError {
    return new ApiError("UNAUTHENTICATED", "Authentification requise.");
  }
  static forbidden(): ApiError {
    return new ApiError("FORBIDDEN", "Accès refusé.");
  }
  static notFound(): ApiError {
    return new ApiError("NOT_FOUND", "Ressource introuvable.");
  }
  static conflict(message: string): ApiError {
    return new ApiError("CONFLICT", message);
  }
  static rateLimited(): ApiError {
    return new ApiError("RATE_LIMITED", "Trop de requêtes. Réessayez plus tard.");
  }
  static internal(): ApiError {
    return new ApiError("INTERNAL_ERROR", "Erreur interne.");
  }
}

/** Convertit une erreur inconnue en erreur contractuelle (message neutralisé). */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return ApiError.internal();
}
