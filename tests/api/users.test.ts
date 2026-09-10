import { test } from "node:test";
import assert from "node:assert/strict";
import { assignRole, removeRole, listUsers } from "../../src/lib/api/admin/service-users.ts";
import { ApiError } from "../../src/lib/api/errors.ts";

// Dépôts en mémoire (aucun réseau).
const ROLES = { admin: "r-admin", editor: "r-editor", reviewer: "r-reviewer", readonly: "r-readonly" };
interface Assignment { profile_id: string; role_id: string; granted_by: string | null }
const inserts: Assignment[] = [];
let deleted: Record<string, string> | null = null;
const deps = {
  insert: async (_t: string, b: Assignment) => { inserts.push(b); return b as never; },
  delete: async (_t: string, f: Record<string, string>) => { deleted = f; },
  fetchOne: async (_t: string, f: Record<string, string>, _s?: string) => {
    const roleId = f.role_id ?? Object.entries(ROLES).find(([k]) => f.code === `eq.${k}`)?.[1];
    if (f.id) {
      const idVal = f.id.replace(/^eq\./, "");
      if (idVal === "profile-1") return { id: "profile-1", email: "cible@x.test", full_name: null, is_active: true, created_at: "2025-01-01T00:00:00Z", roles: [{ code: "editor" }] } as never;
      if (idVal === "profile-missing") return null as never;
      if (Object.values(ROLES).includes(idVal)) return { id: idVal } as never;
      return null as never;
    }
    if (f.code) return { id: roleId } as never;
    if (f["profile_id"] || f.profile_id) return null as never;
    return null as never;
  },
  fetchList: async (_t: string, _opts: unknown) => ({
    rows: [{ id: "profile-1", email: "cible@x.test", full_name: null, is_active: true, created_at: "2025-01-01T00:00:00Z", roles: [{ code: "editor" }] }],
    total: 1,
  }) as never,
};
const adminActor = { id: "admin-1", role: "admin" as const };
const editorActor = { id: "editor-1", role: "editor" as const };

test("users : attribuer un rôle (admin) enregistre l'attribution avec granted_by", async () => {
  await assignRole(adminActor, "profile-1", "editor", deps as never);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].profile_id, "profile-1");
  assert.equal(inserts[0].role_id, ROLES.editor);
  assert.equal(inserts[0].granted_by, "admin-1");
});

test("users : un non-admin ne peut pas attribuer (403)", async () => {
  await assert.rejects(assignRole(editorActor, "profile-1", "editor", deps as never),
    (e) => e instanceof ApiError && e.status === 403);
});

test("users : rôle inconnu -> 422", async () => {
  await assert.rejects(assignRole(adminActor, "profile-1", "superboss", deps as never),
    (e) => e instanceof ApiError && e.status === 422);
});

test("users : profil cible inexistant -> 404", async () => {
  await assert.rejects(assignRole(adminActor, "profile-missing", "editor", deps as never),
    (e) => e instanceof ApiError && e.status === 404);
});

test("users : retirer un rôle appelle le dépôt avec le filtre exact", async () => {
  await removeRole(adminActor, "profile-1", "editor", deps as never);
  assert.ok(deleted);
  assert.equal(deleted!["profile_id"], "eq.profile-1");
  assert.equal(deleted!["role_id"], `eq.${ROLES.editor}`);
});

test("users : auto-retrait du rôle admin interdit (verrouillage)", async () => {
  await assert.rejects(removeRole(adminActor, "admin-1", "admin", deps as never),
    (e) => e instanceof ApiError && e.status === 409);
});

test("users : retirer le rôle admin d'un AUTRE admin est autorisé", async () => {
  await removeRole(adminActor, "profile-1", "admin", deps as never);
  assert.equal(deleted!["profile_id"], "eq.profile-1");
});

test("users : listUsers (admin) recompose les rôles", async () => {
  const listed = await listUsers(adminActor, { page: 1, limit: 10 }, deps as never);
  assert.equal(listed.total, 1);
  assert.equal(listed.rows[0].id, "profile-1");
  assert.equal(listed.rows[0].email, "cible@x.test");
  assert.deepEqual(listed.rows[0].roles, ["editor"]);
  assert.equal(listed.rows[0].isActive, true);
  assert.equal(listed.rows[0].createdAt, "2025-01-01T00:00:00Z");
});

test("users : un non-admin ne peut pas lister (403)", async () => {
  await assert.rejects(listUsers(editorActor, { page: 1, limit: 10 }),
    (e) => e instanceof ApiError && e.status === 403);
});
