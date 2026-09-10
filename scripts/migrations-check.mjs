import { readdirSync, readFileSync } from "node:fs";

const files = readdirSync("supabase/migrations").filter((name) => /^\d{4}[a-z]?_.+\.sql$/.test(name)).sort();
if (!files.length) throw new Error("No numbered migrations found");
const numbers = [...new Set(files.map((name) => Number(name.slice(0, 4))))];
for (let i = 0; i < numbers.length; i += 1) {
  if (numbers[i] !== i + 1) throw new Error(`Migration sequence gap at ${String(i + 1).padStart(4, "0")}`);
}
const seed = readFileSync("supabase/seed.sql", "utf8");
if (!/CONTENT_MODE:\s*(PUBLIC_REVIEW_REQUIRED|APPROVED)/i.test(seed)) throw new Error("Seed must declare its editorial validation mode");
if (/-----BEGIN .*PRIVATE KEY-----|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^$<{]/.test(seed)) throw new Error("Seed contains a possible secret");
console.log(`Migration order passed (${files.length} files, ${numbers.length} ordered versions); seed safety marker passed.`);
