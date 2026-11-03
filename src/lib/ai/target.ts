import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "../db";
import { renderCarousel, renderReel } from "./editor";

export type TargetType = "reel" | "carousel";

/** The current reel/carousel as text for Claude, or null if it doesn't exist. */
export async function loadTargetContext(uid: number, targetType: TargetType, targetId: number) {
  const db = await getDb();
  if (targetType === "reel") {
    const [r] = await db.select().from(schema.reels).where(and(eq(schema.reels.userId, uid), eq(schema.reels.id, targetId)));
    return r ? renderReel(r) : null;
  }
  const [c] = await db.select().from(schema.carousels).where(and(eq(schema.carousels.userId, uid), eq(schema.carousels.id, targetId)));
  return c ? renderCarousel(c) : null;
}

/** The chosen saved prompts, or every prompt for this kind of content when none are chosen. */
export async function loadPrompts(uid: number, targetType: TargetType, promptIds: number[]) {
  const db = await getDb();
  const mine = eq(schema.prompts.userId, uid);
  return promptIds.length
    ? db.select().from(schema.prompts).where(and(mine, inArray(schema.prompts.id, promptIds))).orderBy(asc(schema.prompts.id))
    : db
        .select()
        .from(schema.prompts)
        .where(and(mine, or(eq(schema.prompts.category, targetType), eq(schema.prompts.category, "general"))))
        .orderBy(asc(schema.prompts.id));
}
