import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-[A-Za-z0-9]{20,}/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!<|replace|SECRET_|your-|xxx|\.\.\.|$)[A-Za-z0-9._-]{20,}/,
];
const ignored = new Set([".git", "node_modules", ".next", ".env", ".env.local", "Cahier_des_Charges_SupraCodex-Hub.pdf"]);
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);
const violations = [];
for (const file of files) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  for (const pattern of forbidden) if (pattern.test(text)) violations.push(`${file}: ${pattern}`);
}
if (violations.length) {
  console.error("Potential secret detected:");
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} files inspected).`);
