import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { getDb, schema } from "../db";
import { renderCarousel, renderReel } from "./editor";
import { renderPlan, renderProfile } from "../reels-brain/prompt";

export type TargetType = "reel" | "carousel";

/** The client's Reels Brain profile as text (who the content is for). */
async function clientContext(uid: number, clientId: number) {
  const db = await getDb();
  const [c] = await db
    .select({ name: schema.clients.name, profile: schema.clients.profile })
    .from(schema.clients)
    .where(and(eq(schema.clients.userId, uid), eq(schema.clients.id, clientId)));
  return c ? renderProfile(c.name, c.profile) : "";
}

/** The current reel/carousel as text for Claude (with the client profile and reel plan), or null if it doesn't exist. */
export async function loadTargetContext(uid: number, targetType: TargetType, targetId: number) {
  const db = await getDb();
  if (targetType === "reel") {
    const [r] = await db.select().from(schema.reels).where(and(eq(schema.reels.userId, uid), eq(schema.reels.id, targetId)));
    if (!r) return null;
    return [await clientContext(uid, r.clientId), renderReel(r), renderPlan(r.plan)].filter(Boolean).join("\n\n");
  }
  const [c] = await db.select().from(schema.carousels).where(and(eq(schema.carousels.userId, uid), eq(schema.carousels.id, targetId)));
  if (!c) return null;
  return [await clientContext(uid, c.clientId), renderCarousel(c)].filter(Boolean).join("\n\n");
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
