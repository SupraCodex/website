
import { ApiError } from "../errors.ts";
import type { AppRoleCode } from "../auth.ts";
import type { ContentStatus } from "./validate.ts";

export type ContentAction = "submit" | "publish" | "archive" | "unarchive" | "reject" | "delete";

/** Matrice des transitions autorisées par rôle. */
const TRANSITIONS: Record<ContentStatus, Record<ContentAction, { to: ContentStatus; roles: AppRoleCode[] } | null>> = {
  draft: {
    submit: { to: "review", roles: ["admin", "editor"] },
    publish: null, // jamais direct : passage par review
    archive: null,
    unarchive: null,
    reject: null,
    delete: { to: "draft", roles: ["admin"] }, // soft-delete géré en service (statut séparé ou suppression)
  },
  review: {
    submit: null,
    publish: { to: "published", roles: ["admin"] },
    archive: null,
    unarchive: null,
    reject: { to: "draft", roles: ["admin", "reviewer"] }, // rejet commenté -> retour brouillon
    delete: null,
  },
  published: {
    submit: null,
    publish: { to: "published", roles: ["admin"] }, // idempotence
    archive: { to: "archived", roles: ["admin"] },
    unarchive: null,
    reject: null,
    delete: null,
  },
  archived: {
    submit: null,
    publish: null,
    archive: { to: "archived", roles: ["admin"] }, // idempotence
    unarchive: { to: "draft", roles: ["admin"] }, // retour en brouillon
    reject: null,
    delete: null,
  },
};

export interface TransitionResult {
  next: ContentStatus;
  /** Horodatage à appliquer (published_at / archived_at) maintenant si la transition l'exige. */
  setPublishedAt?: boolean;
  setArchivedAt?: boolean;
  clearArchivedAt?: boolean;
}

/** Vérifie si une action est autorisée pour un rôle donné sur un statut. */
export function canTransition(from: ContentStatus, action: ContentAction, role: AppRoleCode): boolean {
  const t = TRANSITIONS[from]?.[action];
  return !!t && t.roles.includes(role);
}

/** Calcule la transition ; lève CONFLICT si interdite. */
export function applyTransition(from: ContentStatus, action: ContentAction, role: AppRoleCode): TransitionResult {
  const t = TRANSITIONS[from]?.[action];
  if (!t) throw ApiError.conflict("Transition interdite.");
  if (!t.roles.includes(role)) throw ApiError.forbidden();

  const result: TransitionResult = { next: t.to };
  if (action === "publish") {
    result.setPublishedAt = true;
    result.clearArchivedAt = true;
  } else if (action === "archive") {
    result.setArchivedAt = true;
  } else if (action === "unarchive") {
    result.clearArchivedAt = true;
  }
  return result;
}

export interface PublishabilityReport {
  publishable: boolean;
  reasons: string[];
}

export function checkPublishability(input: {
  title?: string;
  excerpt?: string;
  body?: unknown[];
  coverMediaId?: string | null;
}): PublishabilityReport {
  const reasons: string[] = [];
  if (!input.title || input.title.trim().length < 3) reasons.push("titre requis (min 3 car.)");
  if (!input.excerpt || input.excerpt.trim().length < 10) reasons.push("résumé requis (min 10 car.)");
  if (!input.body || !Array.isArray(input.body) || input.body.length === 0) reasons.push("corps requis");
  if (!input.coverMediaId) reasons.push("image de couverture requise");
  return { publishable: reasons.length === 0, reasons };
}
