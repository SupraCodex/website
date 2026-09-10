/**
 * Garde commune aux tests de contrat réseau : sans configuration Supabase
 * (exécution hors ligne, CI sans secrets), ces tests sont ignorés et non en échec.
 */
import { test } from "node:test";
import "./load-env.ts";

export const hasSupabaseEnv =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

let supabaseReachable = false;
if (hasSupabaseEnv) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
    const response = await fetch(`${url}/auth/v1/health`, {
      signal: AbortSignal.timeout(15000),
    });
    supabaseReachable = response.ok || response.status === 401;
  } catch {
    supabaseReachable = false;
  }
}

// Si le staging est injoignable, ces tests d’intégration sont ignorés plutôt
// que transformés en faux échecs. Ils redeviennent actifs dès que le réseau
// et les secrets du staging sont disponibles.
export const netTest = hasSupabaseEnv && supabaseReachable ? test : test.skip;
