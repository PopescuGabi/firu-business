/**
 * Copies everything you set up locally (.data/pg) into the online database.
 *
 *   npm run copy-to-supabase
 *
 * The Supabase connection string comes from DATABASE_URL, or from SUPABASE_DATABASE_URL in
 * .env.local (paste it in Settings → Keys).
 *
 * Stop the local site first (the local database can only be open once).
 * The online database must be empty; add --replace to overwrite it.
 * Google sign-in and Claude usage aren't copied: just sign in with Google again online.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { migrate as migrateLite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema.ts";

const root = path.join(import.meta.dirname, "..");
const migrationsFolder = path.join(root, "drizzle");
const replace = process.argv.includes("--replace");
const targetArg = process.argv.find((a) => a.startsWith("--target="))?.slice("--target=".length);
const sourceArg = process.argv.find((a) => a.startsWith("--source="))?.slice("--source=".length);

// Parents before children (foreign keys).
const TABLES = [
  ["settings", schema.settings],
  ["school_days", schema.schoolDays],
  ["school_classes", schema.schoolClasses],
  ["gym_days", schema.gymDays],
  ["tutoring", schema.tutoring],
  ["clients", schema.clients],
  ["app_updates", schema.appUpdates],
  ["reels", schema.reels],
  ["carousels", schema.carousels],
  ["prompts", schema.prompts],
  ["ai_messages", schema.aiMessages],
  ["tasks", schema.tasks],
  ["plan_blocks", schema.planBlocks],
  ["client_feedback", schema.clientFeedback],
  ["portfolio_items", schema.portfolioItems],
] as const;
const SERIAL = ["tutoring", "clients", "app_updates", "reels", "carousels", "prompts", "ai_messages", "tasks", "plan_blocks", "client_feedback", "portfolio_items"];

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

async function main() {
  // Source: the local database.
  const lite = new PGlite(sourceArg ?? path.join(root, ".data", "pg"));
  const source = drizzleLite(lite, { schema });
  await migrateLite(source, { migrationsFolder });

  // Target: Supabase (DATABASE_URL), or another local folder for testing (--target=pglite:<dir>).
  let target: ReturnType<typeof drizzlePg<typeof schema>>;
  let close = async () => {};
  if (targetArg?.startsWith("pglite:")) {
    const t = new PGlite(targetArg.slice("pglite:".length));
    target = drizzleLite(t, { schema }) as unknown as typeof target;
    await migrateLite(target as never, { migrationsFolder });
    close = () => t.close();
  } else {
    const url = process.env.DATABASE_URL || readLocalEnv("SUPABASE_DATABASE_URL");
    if (!url) throw new Error("Paste your Supabase connection string in Settings → Keys first.");
    const client = postgres(url, { prepare: false, max: 1 });
    target = drizzlePg(client, { schema });
    await migratePg(target, { migrationsFolder });
    close = () => client.end();
  }

  const existing = await target.select().from(schema.clients);
  if (existing.length && !replace) {
    throw new Error("The online database already has data. Run again with --replace to overwrite it.");
  }

  await target.transaction(async (tx) => {
    // Without clients, the online database only holds the default settings from a first visit: safe to clear.
    {
      await tx.execute(sql.raw(`TRUNCATE ${TABLES.map(([n]) => `"${n}"`).reverse().join(", ")} RESTART IDENTITY CASCADE`));
    }
    for (const [name, table] of TABLES) {
      const rows = await source.select().from(table);
      for (let i = 0; i < rows.length; i += 200) {
        await tx.insert(table).values(rows.slice(i, i + 200) as never);
      }
      console.log(`  ${name}: ${rows.length}`);
    }
    for (const name of SERIAL) {
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${name}"', 'id'), COALESCE((SELECT MAX(id) FROM "${name}"), 0) + 1, false)`));
    }
  });

  await lite.close();
  await close();
  console.log("Done. Open the online site and sign in with Google to connect Calendar and Drive there.");
}

main().catch((err) => {
  console.error(`\nCopy failed: ${err instanceof Error ? err.message : err}`);
  if (String(err).includes("lock") || String(err).includes("Aborted")) {
    console.error("Is the local site still running? Stop it first.");
  }
  process.exit(1);
});
