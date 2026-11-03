/**
 * Saves every table to JSON, outside the repo (~/Documents/Personal Hub/backups/<source>-<time>/).
 *
 *   npm run backup            # the online database (DATABASE_URL, or SUPABASE_DATABASE_URL in .env.local)
 *   npm run backup -- --local # this Mac's database (stop the local site first)
 *
 * Google tokens stay encrypted in the dump. Keep backups private: they contain your data.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

const root = path.join(import.meta.dirname, "..");
const local = process.argv.includes("--local");

function readLocalEnv(key: string) {
  try {
    const line = readFileSync(path.join(root, ".env.local"), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim() || undefined;
  } catch {
    return undefined;
  }
}

type Query = (sql: string) => Promise<Record<string, unknown>[]>;

async function main() {
  let query: Query;
  let close: () => Promise<void>;
  if (local) {
    const lite = new PGlite(path.join(root, ".data", "pg"));
    query = async (sql) => (await lite.query<Record<string, unknown>>(sql)).rows;
    close = () => lite.close();
  } else {
    const url = process.env.DATABASE_URL || readLocalEnv("SUPABASE_DATABASE_URL");
    if (!url) throw new Error("No online database address (Settings → Keys → Supabase connection string).");
    const client = postgres(url, { prepare: false, max: 1 });
    query = async (sql) => (await client.unsafe(sql)) as unknown as Record<string, unknown>[];
    close = () => client.end();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(homedir(), "Documents", "Personal Hub", "backups", `${local ? "local" : "online"}-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const tables = await query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
  for (const { table_name } of tables) {
    const rows = await query(`select * from "${table_name}"`);
    writeFileSync(path.join(dir, `${table_name}.json`), JSON.stringify(rows, null, 1));
    console.log(`  ${table_name}: ${rows.length}`);
  }
  await close();
  console.log(`Saved to ${dir}`);
}

main().catch((err) => {
  console.error(`\nBackup failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
