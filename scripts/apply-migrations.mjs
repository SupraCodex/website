/**
 * Exécuteur de migrations vers le projet Supabase HÉBERGÉ (autorisation commanditaire explicite).
 * - Connexion PostgreSQL directe via le pooler (pas de Docker, pas de CLI).
 * - Aucune valeur de secret n'est imprimée.
 * - Journal des migrations appliquées : table schema_migrations.
 * Usage : node scripts/apply-migrations.mjs [--with-seed]
 */
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

// Chargement minimal de .env
const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf-8").split(/\r?\n/)) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
// Pooler de session (port 5432) — utilisateur postgres.<ref-projet>
const config = {
  host: process.env.SUPABASE_DB_HOST || "aws-0-us-west-2.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: `postgres.${projectRef}`,
  database: "postgres",
  password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const client = new pg.Client(config);
await client.connect();
console.log("connecté au pooler (identité non imprimée)");

await client.query(`create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
)`);

const migDir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(migDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
let applied = 0;
for (const file of files) {
  const version = file.replace(/\.sql$/, "");
  const { rows } = await client.query("select 1 from schema_migrations where version = $1", [version]);
  if (rows.length > 0) {
    console.log(`= ${version} déjà appliquée`);
    continue;
  }
  const sql = readFileSync(new URL(file, migDir), "utf-8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into schema_migrations(version) values ($1)", [version]);
    await client.query("commit");
    console.log(`+ ${version} appliquée`);
    applied++;
  } catch (e) {
    await client.query("rollback");
    console.error(`! ${version} ÉCHEC: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv.includes("--with-seed")) {
  const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf-8");
  try {
    await client.query("begin");
    await client.query(seed);
    await client.query("commit");
    console.log("+ seed.sql appliqué");
  } catch (e) {
    await client.query("rollback");
    console.error(`! seed ÉCHEC: ${e.message}`);
    process.exit(1);
  }
}

const { rows: tbls } = await client.query(
  "select table_name from information_schema.tables where table_schema='public' order by table_name",
);
console.log("tables public:", tbls.map((t) => t.table_name).join(", "));
await client.end();
console.log(`terminé (${applied} migration(s) appliquée(s) cette exécution)`);
