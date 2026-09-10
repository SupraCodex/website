
import { ApiError } from "../errors.ts";
import type { AppRoleCode } from "../auth.ts";
import { adminFetchList, adminFetchOne, adminInsert, adminDelete, type ProfileRow } from "./repository.ts";
import type { AdminDeps } from "./service.ts";

const ASSIGNABLE_ROLES: AppRoleCode[] = ["admin", "editor", "reviewer", "readonly"];

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  roles: AppRoleCode[];
  createdAt: string;
}

/** Liste des comptes avec leurs rôles (admin uniquement). */
export async function listUsers(
  actor: { id: string; role: AppRoleCode },
  opts: { page: number; limit: number },
  deps: AdminDeps = {},
): Promise<{ rows: ManagedUser[]; total: number }> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const fetchList = deps.fetchList ?? adminFetchList;
  const result = await fetchList<ProfileRow & { created_at?: string }>("profiles", {
    page: opts.page, limit: opts.limit, order: "created_at.desc",
    select: "id,email,full_name,is_active,created_at,roles(code)",
  });
  const rows: ManagedUser[] = result.rows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: (r as { full_name?: string | null }).full_name ?? null,
    isActive: r.is_active,
    roles: (r.roles ?? []).map((x) => x.code),
    createdAt: (r as { created_at?: string }).created_at ?? "",
  }));
  return { rows, total: result.total };
}

async function fetchTargetProfile(userId: string, deps: AdminDeps): Promise<{ email: string; isActive: boolean }> {
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const profile = await fetchOne<{ email: string; is_active: boolean }>("profiles", { id: `eq.${userId}` }, "email,is_active");
  if (!profile) throw ApiError.notFound();
  return { email: profile.email, isActive: profile.is_active };
}

async function roleIdByCode(code: AppRoleCode, deps: AdminDeps): Promise<string> {
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const role = await fetchOne<{ id: string }>("roles", { code: `eq.${code}` }, "id");
  if (!role) throw ApiError.internal();
  return role.id;
}

/** Attribue un rôle additif (admin uniquement ; pas d'auto-élévation interdite ici : admin est déjà le sommet). */
export async function assignRole(
  actor: { id: string; role: AppRoleCode }, userId: string, rawRole: unknown, deps: AdminDeps = {},
): Promise<ManagedUser> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const code = ASSIGNABLE_ROLES.includes(rawRole as AppRoleCode)
    ? (rawRole as AppRoleCode)
    : (() => { throw ApiError.validation("Requête invalide.", [{ field: "role", issue: "rôle inconnu" }]); })();
  await fetchTargetProfile(userId, deps);
  const roleId = await roleIdByCode(code, deps);
  const insert = deps.insert ?? adminInsert;
  await insert("role_assignments", {
    profile_id: userId, role_id: roleId, granted_by: actor.id,
  });
  return describeUser(userId, deps);
}

/**
 * Retire un rôle (descente de privilèges, admin uniquement).
 * Garde-fou : un admin ne peut pas retirer son propre rôle admin
 * (sinon il pourrait se verrouiller lui-même hors de l'administration).
 * Après retrait, l'utilisateur retombe sur readonly s'il l'a, sinon sur null.
 */
export async function removeRole(
  actor: { id: string; role: AppRoleCode }, userId: string, rawRole: unknown, deps: AdminDeps = {},
): Promise<ManagedUser> {
  if (actor.role !== "admin") throw ApiError.forbidden();
  const code = ASSIGNABLE_ROLES.includes(rawRole as AppRoleCode)
    ? (rawRole as AppRoleCode)
    : (() => { throw ApiError.validation("Requête invalide.", [{ field: "role", issue: "rôle inconnu" }]); })();
  if (userId === actor.id && code === "admin") {
    throw ApiError.conflict("Impossible de retirer son propre rôle admin.");
  }
  await fetchTargetProfile(userId, deps);
  const roleId = await roleIdByCode(code, deps);
  const del = deps.delete ?? adminDelete;
  await del("role_assignments", { profile_id: `eq.${userId}`, role_id: `eq.${roleId}` });
  return describeUser(userId, deps);
}

/** Recompose l'état complet d'un compte après modification. */
export async function describeUser(userId: string, deps: AdminDeps = {}): Promise<ManagedUser> {
  const fetchOne = deps.fetchOne ?? adminFetchOne;
  const profile = await fetchOne<ProfileRow & { created_at?: string }>("profiles", { id: `eq.${userId}` },
    "id,email,full_name,is_active,created_at,roles(code)");
  if (!profile) throw ApiError.notFound();
  return {
    id: profile.id,
    email: profile.email,
    fullName: (profile as { full_name?: string | null }).full_name ?? null,
    isActive: profile.is_active,
    roles: (profile.roles ?? []).map((x) => x.code),
    createdAt: (profile as { created_at?: string }).created_at ?? "",
  };
}
