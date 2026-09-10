/**
 * Charge .env dans process.env pour les tests hors serveur Next (tests uniquement).
 * Ne remplace jamais une variable déjà définie ; n'imprime aucune valeur.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envFile = join(root, ".env");
// Fichier absent (exécution hors ligne / CI sans secrets) : les tests réseau s'ignorent d'eux-mêmes.
const lines = existsSync(envFile) ? readFileSync(envFile, "utf-8").split(/\r?\n/) : [];
for (const line of lines) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !(m[1] in process.env)) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
