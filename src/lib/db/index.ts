import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { migrate as migrateLite } from "drizzle-orm/pglite/migrator";
import { connection } from "next/server";
import postgres from "postgres";
import * as schema from "./schema";
import { seed } from "./seed";

type Db = ReturnType<typeof drizzlePg<typeof schema>>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Supabase transaction pooler does not support prepared statements.
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzlePg(client, { schema });
    await migratePg(db, { migrationsFolder });
    await seed(db);
    return db;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".data", "pg");
  mkdirSync(dir, { recursive: true });
  const lite = new PGlite(dir);
  const db = drizzleLite(lite, { schema });
  await migrateLite(db, { migrationsFolder });
  await seed(db as unknown as Db);
  return db as unknown as Db;
}

const g = globalThis as unknown as { __db?: Promise<Db> };

export async function getDb(): Promise<Db> {
  // Your data is personal: never touch the database while pre-rendering at build time.
  await connection();
  g.__db ??= connect().catch((err) => {
    g.__db = undefined;
    throw err;
  });
  return g.__db;
}

export { schema };
