import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { DEFAULT_SETTINGS, type AppSettings, type PlanAdvice } from "./settings-defaults";

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out as AppSettings;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const db = await getDb();
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }
}

export async function getPlanAdvice(): Promise<PlanAdvice | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "planAdvice"));
  return row?.value as PlanAdvice | undefined;
}
