import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { DEFAULT_SETTINGS, type AppSettings, type PlanAdvice } from "./settings-defaults";

/** This person's settings (defaults for anything they haven't set), once per page render. */
export const getSettings = cache(async (uid: number): Promise<AppSettings> => {
  const db = await getDb();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.userId, uid));
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as AppSettings;
});

export async function saveSettings(uid: number, patch: Partial<AppSettings>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await setSetting(uid, key, value);
  }
}

/** Any per-person value (plan advice, sync timestamps…), outside the typed settings. */
export async function getSetting<T>(uid: number, key: string): Promise<T | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(and(eq(schema.settings.userId, uid), eq(schema.settings.key, key)));
  return (row?.value as T) ?? null;
}

export async function setSetting(uid: number, key: string, value: unknown) {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ userId: uid, key, value })
    .onConflictDoUpdate({ target: [schema.settings.userId, schema.settings.key], set: { value } });
}

export async function getPlanAdvice(uid: number): Promise<PlanAdvice | undefined> {
  return (await getSetting<PlanAdvice>(uid, "planAdvice")) ?? undefined;
}
