"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { GOAL_METRICS, PLATFORMS, POST_KINDS } from "@/lib/marketing";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.coerce.number().int().positive();
const optId = id.nullable().catch(null);
const count = z.coerce.number().int().min(0).max(2_000_000_000).catch(0);

const postFields = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  platform: z.enum(PLATFORMS.map((p) => p.key) as [string, ...string[]]),
  kind: z.enum(POST_KINDS.map((k) => k.key) as [string, ...string[]]),
  url: z.string().trim().max(500).refine((u) => !u || /^https?:\/\//.test(u), "Links start with https://").catch(""),
  postedOn: day,
  postedAt: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
  clientId: optId,
  reelId: optId,
  carouselId: optId,
});

/** Linked client / reel / carousel ids must be this person's. */
async function checkOwned(uid: number, v: { clientId: number | null; reelId: number | null; carouselId: number | null }) {
  const db = await getDb();
  const one = async (table: typeof schema.clients | typeof schema.reels | typeof schema.carousels, rowId: number | null) => {
    if (rowId === null) return;
    const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, rowId), eq(table.userId, uid)));
    if (!row) throw new Error("Not found");
  };
  await Promise.all([one(schema.clients, v.clientId), one(schema.reels, v.reelId), one(schema.carousels, v.carouselId)]);
}

function readPost(fd: FormData) {
  return postFields.parse({
    title: fd.get("title"),
    platform: fd.get("platform"),
    kind: fd.get("kind"),
    url: fd.get("url") ?? "",
    postedOn: fd.get("postedOn"),
    postedAt: fd.get("postedAt") || null,
    clientId: fd.get("clientId") || null,
    reelId: fd.get("reelId") || null,
    carouselId: fd.get("carouselId") || null,
  });
}

const readStats = (fd: FormData) => ({
  views: count.parse(fd.get("views")),
  likes: count.parse(fd.get("likes")),
  comments: count.parse(fd.get("comments")),
  shares: count.parse(fd.get("shares")),
  saves: count.parse(fd.get("saves")),
  follows: count.parse(fd.get("follows")),
  reach: count.parse(fd.get("reach")),
});
const hasStats = (s: ReturnType<typeof readStats>) => Object.values(s).some((n) => n > 0);

const refresh = () => revalidatePath("/", "layout");

/** Logs a post (and its first numbers, if given). */
export async function logPost(fd: FormData) {
  const user = await requireUser();
  const v = readPost(fd);
  await checkOwned(user.id, v);
  const db = await getDb();
  const [post] = await db.insert(schema.posts).values({ userId: user.id, ...v }).returning({ id: schema.posts.id });
  const stats = readStats(fd);
  if (hasStats(stats)) {
    await db.insert(schema.postStats).values({ userId: user.id, postId: post.id, recordedOn: todayIn((await getSettings(user.id)).timezone), ...stats });
  }
  refresh();
}

export async function updatePost(postId: number, fd: FormData) {
  const user = await requireUser();
  const v = readPost(fd);
  await checkOwned(user.id, v);
  const db = await getDb();
  await db.update(schema.posts).set({ ...v, updatedAt: new Date() }).where(and(eq(schema.posts.id, id.parse(postId)), eq(schema.posts.userId, user.id)));
  refresh();
}

export async function deletePost(postId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.posts).where(and(eq(schema.posts.id, id.parse(postId)), eq(schema.posts.userId, user.id)));
  refresh();
}

/** New numbers for a post (kept as history, so growth shows over time). */
export async function addPostStats(postId: number, fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  const [post] = await db.select({ id: schema.posts.id }).from(schema.posts).where(and(eq(schema.posts.id, id.parse(postId)), eq(schema.posts.userId, user.id)));
  if (!post) throw new Error("Post not found");
  await db.insert(schema.postStats).values({ userId: user.id, postId: post.id, recordedOn: todayIn((await getSettings(user.id)).timezone), ...readStats(fd) });
  refresh();
}

export async function saveGoal(fd: FormData) {
  const user = await requireUser();
  const metric = z.enum(GOAL_METRICS.map((g) => g.key) as [string, ...string[]]).parse(fd.get("metric"));
  const raw = z.coerce.number().positive().max(1e9).parse(fd.get("target"));
  const v = {
    metric,
    target: Math.round(metric === "engagement" ? raw * 10 : raw), // engagement in tenths of a percent
    period: z.enum(["week", "month"]).catch("month").parse(fd.get("period")),
    clientId: optId.parse(fd.get("clientId") || null),
  };
  await checkOwned(user.id, { clientId: v.clientId, reelId: null, carouselId: null });
  const db = await getDb();
  const goalId = optId.parse(fd.get("goalId") || null);
  if (goalId) await db.update(schema.goals).set(v).where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, user.id)));
  else await db.insert(schema.goals).values({ userId: user.id, ...v });
  refresh();
}

export async function deleteGoal(goalId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.goals).where(and(eq(schema.goals.id, id.parse(goalId)), eq(schema.goals.userId, user.id)));
  refresh();
}
