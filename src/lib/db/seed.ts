import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "./schema";
import { DEFAULT_SETTINGS } from "../settings-defaults";

// A fresh database starts empty: add your timetable, gym split, tutoring, travel times
// and clients in the app (or copy them in with `npm run copy-to-supabase`).
export async function seed(db: PgDatabase<PgQueryResultHKT, typeof s>) {
  const seeded = await db.select().from(s.settings).where(sql`${s.settings.key} = 'seeded'`);
  if (seeded.length) return;
  await db
    .insert(s.settings)
    .values([...Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })), { key: "seeded", value: true }])
    .onConflictDoNothing();
}
