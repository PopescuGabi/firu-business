import "server-only";
import { asc, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "../db";
import { renderCarousel, renderReel } from "./editor";

export type TargetType = "reel" | "carousel";

/** The current reel/carousel as text for Claude, or null if it doesn't exist. */
export async function loadTargetContext(targetType: TargetType, targetId: number) {
  const db = await getDb();
  if (targetType === "reel") {
    const [r] = await db.select().from(schema.reels).where(eq(schema.reels.id, targetId));
    return r ? renderReel(r) : null;
  }
  const [c] = await db.select().from(schema.carousels).where(eq(schema.carousels.id, targetId));
  return c ? renderCarousel(c) : null;
}

/** The chosen saved prompts, or every prompt for this kind of content when none are chosen. */
export async function loadPrompts(targetType: TargetType, promptIds: number[]) {
  const db = await getDb();
  return promptIds.length
    ? db.select().from(schema.prompts).where(inArray(schema.prompts.id, promptIds)).orderBy(asc(schema.prompts.id))
    : db
        .select()
        .from(schema.prompts)
        .where(or(eq(schema.prompts.category, targetType), eq(schema.prompts.category, "general")))
        .orderBy(asc(schema.prompts.id));
}
