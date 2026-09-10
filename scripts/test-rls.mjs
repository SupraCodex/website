import { pass, fail, url, createTestUser, cleanup } from "./test-rls-helpers.mjs";
import { runChecks } from "./test-rls-checks.mjs";

async function main() {
  console.log("=== Tests RLS (Supabase distant) ===\n");
  console.log(`Cible: ${url}`);
  const stamp = Date.now();
  const users = {};
  try {
    console.log("Création des utilisateurs de test...");
    users.admin = await createTestUser(`rls-admin-${stamp}@test.local`, "admin");
    users.editor = await createTestUser(`rls-editor-${stamp}@test.local`, "editor");
    users.reviewer = await createTestUser(`rls-reviewer-${stamp}@test.local`, "reviewer");
    users.readonly = await createTestUser(`rls-readonly-${stamp}@test.local`, "readonly");
    console.log("Utilisateurs créés.\n");
    await runChecks(users, stamp);
  } finally {
    console.log("\nNettoyage...");
    await cleanup(Object.values(users));
  }
  console.log(`\n=== RESULTAT : ${pass} réussis, ${fail} échoués ===`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
