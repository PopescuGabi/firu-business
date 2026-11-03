import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "./schema";
import { ALL_MODULES } from "../modules";

/**
 * After migrations: user 1 is the owner (ALLOWED_EMAIL). A fresh database starts empty otherwise;
 * everyone adds their own timetable, clients and so on in the app.
 */
export async function seed(db: PgDatabase<PgQueryResultHKT, typeof s>) {
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const [owner] = await db.select().from(s.users).where(eq(s.users.id, 1));
  if (!owner) {
    if (email) await db.insert(s.users).values({ id: 1, email, role: "owner", modules: ALL_MODULES, onboarded: true }).onConflictDoNothing();
    return;
  }
  const patch: Partial<typeof s.users.$inferInsert> = {};
  if (email && owner.email !== email) patch.email = email;
  if (owner.role !== "owner") patch.role = "owner";
  if (!owner.modules.length) patch.modules = ALL_MODULES;
  if (Object.keys(patch).length) await db.update(s.users).set(patch).where(eq(s.users.id, 1));
}
