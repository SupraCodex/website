import { existsSync, readFileSync } from "node:fs";
const env = {};
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf-8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const value = (name) => process.env[name] ?? env[name] ?? "";
export const url = value("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
export const anon = value("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const svc = value("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anon || !svc) {
  throw new Error("RLS tests require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY");
}
export const H = { apikey: svc, Authorization: `Bearer ${svc}`, "content-type": "application/json" };

export let pass = 0, fail = 0;
export function check(name, expected, actual, detail) {
  const ok = actual === expected;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✔" : "✖"} ${name} (attendu: ${expected}, obtenu: ${actual})${detail ? " — " + detail : ""}`);
}

export async function createTestUser(email, roleCode) {
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST", headers: H,
    body: JSON.stringify({ email, password: "Test!ter@tion#RLS9", email_confirm: true }),
  });
  const user = await createRes.json();
  if (!user.id && createRes.status === 400) {
    const list = await fetch(`${url}/auth/v1/admin/users?email=eq.${email}`, { headers: H });
    user.id = (await list.json()).users?.[0]?.id;
  }
  if (!user.id) throw new Error(`échec création ${email}: ${JSON.stringify(user)}`);
  await fetch(`${url}/rest/v1/profiles`, {
    method: "POST", headers: { ...H, prefer: "return=minimal" },
    body: JSON.stringify({ id: user.id, email, is_active: true }),
  });
  const roles = await fetch(`${url}/rest/v1/roles?code=eq.${roleCode}&select=id`, { headers: H });
  const roleId = (await roles.json())[0]?.id;
  await fetch(`${url}/rest/v1/role_assignments`, {
    method: "POST", headers: { ...H, prefer: "return=minimal" },
    body: JSON.stringify({ profile_id: user.id, role_id: roleId }),
  });
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Test!ter@tion#RLS9" }),
  });
  const token = (await login.json()).access_token;
  return { id: user.id, email, token };
}

export async function cleanup(users) {
  for (const u of users) {
    await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: H });
  }
}
