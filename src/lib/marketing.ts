import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import { addDays, mondayOf, weekdayOf } from "./time";

export const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "other", label: "Other" },
] as const;
export const POST_KINDS = [
  { key: "reel", label: "Reel / short" },
  { key: "carousel", label: "Carousel" },
  { key: "video", label: "Video" },
  { key: "post", label: "Post" },
  { key: "story", label: "Story" },
] as const;
export const GOAL_METRICS = [
  { key: "views", label: "Views" },
  { key: "engagement", label: "Engagement rate (%)" },
  { key: "posts", label: "Posts" },
  { key: "follows", label: "New followers" },
  { key: "income", label: "Income" },
] as const;

export const platformLabel = (k: string) => PLATFORMS.find((p) => p.key === k)?.label ?? k;
export const kindLabel = (k: string) => POST_KINDS.find((p) => p.key === k)?.label ?? k;

type Stats = { views: number; likes: number; comments: number; shares: number; saves: number; follows: number; reach: number };
const ZERO: Stats = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, follows: 0, reach: 0 };
export type PostRow = typeof schema.posts.$inferSelect & { stats: Stats; history: { on: string; views: number }[] };

const interactions = (s: Stats) => s.likes + s.comments + s.shares + s.saves;
/** Interactions per view, as a percentage (0 when there are no views). */
export const engagement = (s: Stats) => (s.views ? (interactions(s) / s.views) * 100 : 0);

/** Posts (for one client, or all), each with its latest numbers and how its views grew. */
export async function loadPosts(uid: number, clientId?: number): Promise<PostRow[]> {
  const db = await getDb();
  const posts = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.userId, uid), clientId ? eq(schema.posts.clientId, clientId) : undefined))
    .orderBy(desc(schema.posts.postedOn), desc(schema.posts.id));
  if (!posts.length) return [];
  const stats = await db
    .select()
    .from(schema.postStats)
    .where(and(eq(schema.postStats.userId, uid), inArray(schema.postStats.postId, posts.map((p) => p.id))))
    .orderBy(schema.postStats.recordedOn, schema.postStats.id);
  return posts.map((p) => {
    const mine = stats.filter((s) => s.postId === p.id);
    const last = mine.at(-1);
    return {
      ...p,
      stats: last ? { views: last.views, likes: last.likes, comments: last.comments, shares: last.shares, saves: last.saves, follows: last.follows, reach: last.reach } : ZERO,
      history: mine.map((s) => ({ on: s.recordedOn, views: s.views })),
    };
  });
}

const sum = (rows: PostRow[]) =>
  rows.reduce((t, p) => {
    for (const k of Object.keys(t) as (keyof Stats)[]) t[k] += p.stats[k];
    return t;
  }, { ...ZERO });

/** Everything the dashboard shows, from the posts. `today` is the person's local date. */
export function summarize(posts: PostRow[], today: string) {
  const total = sum(posts);
  // Views of the posts published each week, last 12 weeks.
  const thisMonday = mondayOf(today);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisMonday, (i - 11) * 7));
  const weekly = weeks.map((w) => posts.filter((p) => p.postedOn >= w && p.postedOn < addDays(w, 7)).reduce((n, p) => n + p.stats.views, 0));
  const monthKey = today.slice(0, 7);
  const lastMonthKey = addDays(`${monthKey}-01`, -1).slice(0, 7);
  const inMonth = (k: string) => posts.filter((p) => p.postedOn.startsWith(k));
  const byPlatform = PLATFORMS.map((pl) => {
    const rows = posts.filter((p) => p.platform === pl.key);
    const s = sum(rows);
    return { key: pl.key, label: pl.label, posts: rows.length, views: s.views, engagement: engagement(s) };
  }).filter((x) => x.posts > 0);
  const byKind = POST_KINDS.map((k) => {
    const rows = posts.filter((p) => p.kind === k.key);
    const s = sum(rows);
    return { key: k.key, label: k.label, posts: rows.length, avgViews: rows.length ? s.views / rows.length : 0, engagement: engagement(s) };
  }).filter((x) => x.posts > 0);
  // Average views by weekday × hour of posting.
  const cells: { n: number; v: number }[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, v: 0 })));
  for (const p of posts) {
    if (!p.postedAt) continue;
    const c = cells[weekdayOf(p.postedOn) - 1][Number(p.postedAt.slice(0, 2))];
    c.n++;
    c.v += p.stats.views;
  }
  const ranked = [...posts].filter((p) => p.stats.views > 0).sort((a, b) => b.stats.views - a.stats.views);
  return {
    total,
    engagement: engagement(total),
    weeks,
    weekly,
    month: sum(inMonth(monthKey)),
    lastMonth: sum(inMonth(lastMonthKey)),
    postsThisMonth: inMonth(monthKey).length,
    byPlatform,
    byKind,
    heat: cells.map((row) => row.map((c) => (c.n ? c.v / c.n : null))),
    best: ranked.slice(0, 3),
    worst: ranked.length > 3 ? ranked.slice(-3).reverse() : [],
  };
}

/** Reels and carousels marked Posted that haven't been logged as a post yet. */
export async function needsNumbers(uid: number, clientId?: number) {
  const db = await getDb();
  const [reels, carousels, logged] = await Promise.all([
    db.select({ id: schema.reels.id, title: schema.reels.title, clientId: schema.reels.clientId, postDate: schema.reels.postDate }).from(schema.reels).where(and(eq(schema.reels.userId, uid), eq(schema.reels.status, "posted"), clientId ? eq(schema.reels.clientId, clientId) : undefined)),
    db
      .select({ id: schema.carousels.id, title: schema.carousels.title, clientId: schema.carousels.clientId, postDate: schema.carousels.postDate })
      .from(schema.carousels)
      .where(and(eq(schema.carousels.userId, uid), eq(schema.carousels.status, "posted"), clientId ? eq(schema.carousels.clientId, clientId) : undefined)),
    db.select({ reelId: schema.posts.reelId, carouselId: schema.posts.carouselId }).from(schema.posts).where(eq(schema.posts.userId, uid)),
  ]);
  const reelDone = new Set(logged.map((l) => l.reelId));
  const carDone = new Set(logged.map((l) => l.carouselId));
  return [
    ...reels.filter((r) => !reelDone.has(r.id)).map((r) => ({ ...r, kind: "reel" as const })),
    ...carousels.filter((c) => !carDone.has(c.id)).map((c) => ({ ...c, kind: "carousel" as const })),
  ];
}

export async function loadGoals(uid: number, clientId?: number) {
  const db = await getDb();
  return db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.userId, uid), clientId ? eq(schema.goals.clientId, clientId) : isNull(schema.goals.clientId)))
    .orderBy(schema.goals.id);
}

/** This period's progress toward a goal (income is filled in by the caller from the money side). */
export function goalProgress(goal: { metric: string; period: string }, posts: PostRow[], today: string, incomeThisPeriod = 0) {
  const from = goal.period === "week" ? mondayOf(today) : `${today.slice(0, 7)}-01`;
  const rows = posts.filter((p) => p.postedOn >= from && p.postedOn <= today);
  const s = sum(rows);
  switch (goal.metric) {
    case "views":
      return s.views;
    case "engagement":
      return Math.round(engagement(s) * 10); // tenths of a percent, like the target
    case "posts":
      return rows.length;
    case "follows":
      return s.follows;
    case "income":
      return incomeThisPeriod;
    default:
      return 0;
  }
}
