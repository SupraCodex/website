
import { ApiError } from "./errors.ts";

export interface EnvConfig {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cachedConfig: EnvConfig | null = null;

/** Charge la configuration depuis l'environnement (jamais depuis le client). */
export function getConfig(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): EnvConfig {
  if (cachedConfig) return cachedConfig;
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "");
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw ApiError.internal();
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) {
    throw ApiError.internal();
  }
  cachedConfig = { supabaseUrl, anonKey, serviceRoleKey };
  return cachedConfig;
}

export interface AuthUser {
  id: string;
  email: string;
}

/** Vérifie un jeton bearer auprès de Supabase Auth (projet hébergé). */
export async function getAuthUser(bearer: string | null | undefined): Promise<AuthUser> {
  if (!bearer) throw ApiError.unauthenticated();
  const cfg = getConfig();
  let res: Response;
  try {
    res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${bearer}` },
    });
  } catch {
    // Un jeton ne peut pas être validé si Auth est injoignable. Ne jamais
    // transformer cette situation en succès ou exposer un détail réseau.
    throw ApiError.unauthenticated();
  }
  // Tout échec (401, 400 JWT invalide, etc.) = authentification refusée. Aucun détail n'est divulgué.
  if (!res.ok) throw ApiError.unauthenticated();
  let body: { id?: string; email?: string };
  try {
    body = (await res.json()) as { id?: string; email?: string };
  } catch {
    throw ApiError.unauthenticated();
  }
  if (!body.id || !body.email) throw ApiError.unauthenticated();
  return { id: body.id, email: body.email };
}

export type AppRoleCode = "admin" | "editor" | "reviewer" | "readonly";

/**
 * Rôle effectif d'un utilisateur (utilisateur désactivé => null).
 * Utilise la clé service côté serveur ; la logique fine de refus reste dans RLS.
 */
export async function getEffectiveRole(userId: string): Promise<AppRoleCode | null> {
  const cfg = getConfig();
  const params = new URLSearchParams({
    select: "roles(code),profiles!role_assignments_profile_id_fkey(id,is_active)",
    "profiles.id": `eq.${userId}`,
    "profiles.is_active": "eq.true",
    profiles: "not.is.null",
  });
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/role_assignments?${params}`, {
    headers: { apikey: cfg.serviceRoleKey, Authorization: `Bearer ${cfg.serviceRoleKey}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw ApiError.internal();
  const rows = (await res.json()) as { roles: { code: AppRoleCode } }[];
  const codes = rows.map((r) => r.roles?.code).filter((c): c is AppRoleCode => Boolean(c));
  if (codes.includes("admin")) return "admin";
  if (codes.includes("editor")) return "editor";
  if (codes.includes("reviewer")) return "reviewer";
  if (codes.includes("readonly")) return "readonly";
  return null;
}

/** Exige un rôle minimal (matrice docs/permissions-matrix.md). */
export async function requireRole(bearer: string | null | undefined, min: AppRoleCode[]): Promise<{ user: AuthUser; role: AppRoleCode }> {
  const user = await getAuthUser(bearer);
  const role = await getEffectiveRole(user.id);
  if (!role || !min.includes(role)) throw ApiError.forbidden();
  return { user, role };
}

export async function refreshSession(refreshToken: string | null | undefined): Promise<{ accessToken: string; expiresIn: number }> {
  if (!refreshToken) throw ApiError.unauthenticated();
  const cfg = getConfig();
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw ApiError.unauthenticated();
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw ApiError.unauthenticated();
  return { accessToken: body.access_token, expiresIn: body.expires_in ?? 3600 };
}

/** Extrait le bearer de l'en-tête Authorization. */
export function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m ? m[1] : null;
}
