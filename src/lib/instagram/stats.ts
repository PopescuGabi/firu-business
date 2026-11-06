// Pure: everything the Instagram dashboard shows, computed from stored posts and days (or demo data).
import type { IgMetrics } from "../db/schema.ts";
import type { IgKind } from "./parse.ts";

export type IgPost = { mediaId: string; kind: IgKind; caption: string; permalink: string; thumbnail: string | null; postedAt: string; metrics: IgMetrics };
export type IgDay = {
  date: string;
  followers: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  unfollows: number | null;
};
export type KindFilter = "all" | "reel" | "carousel" | "photo";

export const KIND_LABEL: Record<IgKind, string> = { reel: "Reels", carousel: "Carousels", photo: "Photos", video: "Videos" };
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000) + 1;

/** Local date, weekday (0 = Monday) and hour of a timestamp in the person's time zone. */
export function localParts(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday), hour: Number(p.hour) };
}

/** A post's interactions: Instagram's total, or likes + comments + shares + saves. */
export const interactionsOf = (m: IgMetrics) => m.interactions ?? ((m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0) || null);
/** Engagement rate of a post: interactions ÷ reach (%), or null without reach. */
export const engagementOf = (m: IgMetrics) => (m.reach ? ((interactionsOf(m) ?? 0) / m.reach) * 100 : null);

const sum = (xs: (number | null)[]) => (xs.some((x) => x !== null) ? xs.reduce<number>((a, b) => a + (b ?? 0), 0) : null);
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const change = (now: number | null, before: number | null) => (now === null || before === null || before === 0 ? null : ((now - before) / Math.abs(before)) * 100);

export type Kpi = { key: string; label: string; value: number | null; prev: number | null; change: number | null; format: "num" | "pct"; note?: string };

export function buildDashboard({ posts, days, from, to, kind = "all", tz = "UTC" }: { posts: IgPost[]; days: IgDay[]; from: string; to: string; kind?: KindFilter; tz?: string }) {
  const len = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const dayRows = (a: string, b: string) => days.filter((d) => inRange(d.date, a, b));
  const cur = dayRows(from, to);
  const prev = dayRows(prevFrom, prevTo);
  const withLocal = posts.map((p) => ({ ...p, local: localParts(p.postedAt, tz) }));
  const ofKind = (p: { kind: IgKind }) => kind === "all" || p.kind === kind || (kind === "reel" && p.kind === "video");
  const postsIn = (a: string, b: string) => withLocal.filter((p) => inRange(p.local.date, a, b) && ofKind(p));
  const curPosts = postsIn(from, to);
  const prevPosts = postsIn(prevFrom, prevTo);

  // Followers: our daily snapshots (Instagram doesn't keep follower history).
  const lastFollowers = (b: string) => [...days].filter((d) => d.date <= b && d.followers !== null).sort((x, y) => (x.date < y.date ? 1 : -1))[0]?.followers ?? null;
  const firstFollowers = (a: string, b: string) => dayRows(a, b).filter((d) => d.followers !== null).sort((x, y) => (x.date < y.date ? -1 : 1))[0]?.followers ?? null;
  const followersSince = [...days].filter((d) => d.followers !== null).sort((x, y) => (x.date < y.date ? -1 : 1))[0]?.date ?? null;
  const net = (a: string, b: string, rows: IgDay[]) => {
    const f = sum(rows.map((d) => d.follows));
    const u = sum(rows.map((d) => d.unfollows));
    if (f !== null && u !== null) return f - u;
    const end = lastFollowers(b);
    const start = firstFollowers(a, b);
    return end !== null && start !== null ? end - start : null;
  };
  const total = (rows: IgDay[], k: keyof Omit<IgDay, "date" | "followers">) => sum(rows.map((d) => d[k]));
  const eng = (rows: IgDay[]) => {
    const i = total(rows, "interactions");
    const r = total(rows, "reach");
    return i !== null && r ? (i / r) * 100 : null;
  };
  const k = (key: string, label: string, now: number | null, before: number | null, format: "num" | "pct" = "num", note?: string): Kpi => ({
    key,
    label,
    value: now,
    prev: before,
    change: change(now, before),
    format,
    note,
  });
  const kpis: Kpi[] = [
    k("followers", "Followers", lastFollowers(to), lastFollowers(prevTo), "num", followersSince ? `Tracked since ${followersSince}` : "Tracked from the day the account connects"),
    k("net", "Net growth", net(from, to, cur), net(prevFrom, prevTo, prev)),
    k("reach", "Reach", total(cur, "reach"), total(prev, "reach"), "num", "Accounts reached per day, added up"),
    k("views", "Views", total(cur, "views"), total(prev, "views")),
    k("interactions", "Interactions", total(cur, "interactions"), total(prev, "interactions")),
    k("engagement", "Engagement rate", eng(cur), eng(prev), "pct", "Interactions ÷ reach"),
    k("likes", "Likes", total(cur, "likes"), total(prev, "likes")),
    k("comments", "Comments", total(cur, "comments"), total(prev, "comments")),
    k("shares", "Shares", total(cur, "shares"), total(prev, "shares")),
    k("saves", "Saves", total(cur, "saves"), total(prev, "saves")),
    k("follows", "New followers", total(cur, "follows"), total(prev, "follows"), "num", "Instagram gives this only for accounts with 100+ followers"),
    k("unfollows", "Unfollowers", total(cur, "unfollows"), total(prev, "unfollows"), "num", "Instagram gives this only for accounts with 100+ followers"),
  ];

  // Day by day.
  const dates = Array.from({ length: len }, (_, i) => addDays(from, i));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const series = {
    dates,
    reach: dates.map((d) => byDate.get(d)?.reach ?? null),
    views: dates.map((d) => byDate.get(d)?.views ?? null),
    followers: dates.map((d) => byDate.get(d)?.followers ?? null),
  };

  // Weeks (Monday-based): posts per week vs reach in the same week.
  const weekStart = (d: string) => {
    const wd = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
    return addDays(d, -wd);
  };
  const weeks = [...new Set(dates.map(weekStart))];
  const weekly = {
    weeks,
    posts: weeks.map((w) => curPosts.filter((p) => weekStart(p.local.date) === w).length),
    reach: weeks.map((w) => sum(cur.filter((d) => weekStart(d.date) === w).map((d) => d.reach))),
  };

  // Posting heatmap: average post reach by weekday and hour; counts for "when you post most".
  const heat: (number | null)[][] = Array.from({ length: 7 }, () => Array(24).fill(null));
  const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const sums: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const p of curPosts) {
    const { weekday, hour } = p.local;
    if (weekday < 0) continue;
    counts[weekday][hour]++;
    sums[weekday][hour] += p.metrics.reach ?? 0;
  }
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (counts[d][h]) heat[d][h] = sums[d][h] / counts[d][h];

  // Calendar: which days had posts (and of which kind).
  const calendar = dates.map((date) => ({ date, posts: curPosts.filter((p) => p.local.date === date).map((p) => p.kind) }));

  // Formats compared per post (always all kinds, so the comparison is complete).
  const allCur = withLocal.filter((p) => inRange(p.local.date, from, to));
  const formats = (["reel", "carousel", "photo"] as const).map((fk) => {
    const list = allCur.filter((p) => p.kind === fk || (fk === "reel" && p.kind === "video"));
    return {
      kind: fk,
      label: KIND_LABEL[fk],
      posts: list.length,
      reach: avg(list.map((p) => p.metrics.reach)),
      views: avg(list.map((p) => p.metrics.views)),
      engagement: avg(list.map((p) => engagementOf(p.metrics))),
      sharesSaves: avg(list.map((p) => (p.metrics.shares === null && p.metrics.saves === null ? null : (p.metrics.shares ?? 0) + (p.metrics.saves ?? 0)))),
      follows: avg(list.map((p) => p.metrics.follows)),
    };
  });

  const rows = curPosts
    .map((p) => ({ ...p, engagement: engagementOf(p.metrics), interactions: interactionsOf(p.metrics) }))
    .sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  const top = [...rows].sort((a, b) => (b.metrics.reach ?? -1) - (a.metrics.reach ?? -1)).slice(0, 5);

  // In 30 seconds.
  const summary: string[] = [];
  const reachKpi = kpis.find((x) => x.key === "reach")!;
  const fol = kpis.find((x) => x.key === "followers")!;
  const netK = kpis.find((x) => x.key === "net")!;
  if (reachKpi.value !== null) {
    summary.push(
      reachKpi.change === null
        ? `${fmt(reachKpi.value)} accounts reached in ${len} days.`
        : `Reach is ${reachKpi.change >= 0 ? "up" : "down"} ${Math.abs(Math.round(reachKpi.change))}% on the ${len} days before (${fmt(reachKpi.value)}).`,
    );
  }
  const ranked = formats.filter((f) => f.posts >= 2 && f.reach !== null).sort((a, b) => b.reach! - a.reach!);
  if (ranked.length >= 2) {
    const ratio = ranked[0].reach! / Math.max(1, ranked[1].reach!);
    summary.push(`${ranked[0].label} reach the most people: ${fmt(ranked[0].reach!)} per post on average${ratio >= 1.2 ? `, ${ratio.toFixed(1)}× ${ranked[1].label.toLowerCase()}` : ""}.`);
  }
  const perWeek = (n: number) => (n / len) * 7;
  if (curPosts.length) {
    const nowW = perWeek(curPosts.length);
    const beforeW = perWeek(prevPosts.length);
    summary.push(`You posted ${nowW.toFixed(1)} times a week${prevPosts.length ? `, ${nowW >= beforeW ? "up" : "down"} from ${beforeW.toFixed(1)}` : ""}.`);
  } else {
    summary.push(`No posts in these ${len} days.`);
  }
  let best: { d: number; h: number; v: number } | null = null;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (heat[d][h] !== null && counts[d][h] >= 1 && (!best || heat[d][h]! > best.v)) best = { d, h, v: heat[d][h]! };
  if (best && curPosts.length >= 5) summary.push(`Your best-performing posting time was ${WEEKDAYS[best.d]} around ${String(best.h).padStart(2, "0")}:00.`);
  if (netK.value !== null && fol.value !== null) summary.push(`Followers: ${fmt(fol.value)} (${netK.value >= 0 ? "+" : ""}${fmt(netK.value)} in this period).`);

  return { period: { from, to, days: len }, previous: { from: prevFrom, to: prevTo }, kpis, series, weekly, heat, counts, calendar, formats, top, rows, summary, followersSince };
}
export type Dashboard = ReturnType<typeof buildDashboard>;

export const fmt = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k` : Math.round(n).toLocaleString("en-GB"));

/** The period for ?range=7|30|90 or a custom from–to, ending yesterday (today's numbers aren't complete yet). */
export function periodFor(range: string | undefined, today: string, from?: string, to?: string) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (range === "custom" && from && to && re.test(from) && re.test(to) && from <= to) {
    const capped = to > today ? today : to;
    const start = daysBetween(from, capped) > 366 ? addDays(capped, -365) : from;
    return { range: "custom" as const, from: start, to: capped };
  }
  const n = range === "7" ? 7 : range === "90" ? 90 : 30;
  const end = addDays(today, -1);
  return { range: String(n) as "7" | "30" | "90", from: addDays(end, -(n - 1)), to: end };
}
