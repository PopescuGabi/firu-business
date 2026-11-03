import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { BACKGROUNDS, backdropCss, photoBackdrop } from "./backgrounds";
import { getDb, schema } from "./db";
import { getSettings } from "./settings";

/** When this person's photo was uploaded, or null if they have none. */
export const photoVersion = cache(async (uid: number) => {
  const db = await getDb();
  const [row] = await db
    .select({ updatedAt: schema.backgrounds.updatedAt })
    .from(schema.backgrounds)
    .where(eq(schema.backgrounds.userId, uid));
  return row ? row.updatedAt.getTime() : null;
});

/** The background this person picked: its kind (for glass tweaks) and the CSS that paints it. */
export async function getBackground(uid: number): Promise<{ kind: string; css: string }> {
  const { background } = await getSettings(uid);
  if (background === "photo") {
    const v = await photoVersion(uid);
    if (v) return { kind: "photo", css: backdropCss(photoBackdrop(`/api/background?v=${v}`)) };
  }
  const preset = BACKGROUNDS.find((b) => b.key === background) ?? BACKGROUNDS[0];
  return { kind: preset.key, css: backdropCss(preset) };
}
