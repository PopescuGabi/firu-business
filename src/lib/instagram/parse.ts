// Pure: turns Meta's Instagram API JSON into our rows. Tested with recorded responses (tests/instagram.test.ts).
// Anything Instagram doesn't return stays null, so the dashboard can say "not available" instead of showing 0.
import type { IgMetrics } from "../db/schema.ts";

export type IgKind = "reel" | "carousel" | "photo" | "video";

type InsightValue = { value?: unknown; end_time?: string };
type Breakdown = { dimension_keys?: string[]; results?: { dimension_values?: string[]; value?: unknown }[] };
export type InsightItem = { name: string; period?: string; values?: InsightValue[]; total_value?: { value?: unknown; breakdowns?: Breakdown[] } };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

/** A metric's value from an insights response (handles both `values[0].value` and `total_value.value`). */
export function insightValue(items: InsightItem[] | undefined, name: string): number | null {
  const it = items?.find((i) => i.name === name);
  if (!it) return null;
  return num(it.total_value?.value) ?? num(it.values?.[0]?.value);
}

/** Our kind for a media item; stories and ads are left out. */
export function kindOf(m: { media_type?: string; media_product_type?: string }): IgKind | null {
  if (m.media_product_type === "STORY" || m.media_product_type === "AD") return null;
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  if (m.media_type === "IMAGE") return "photo";
  if (m.media_type === "VIDEO") return "video";
  return null;
}

/** Which insight metrics to ask for per kind (asking for one a kind doesn't support fails the whole call). */
export function metricsFor(kind: IgKind) {
  const base = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"];
  return kind === "reel" ? [...base, "ig_reels_avg_watch_time"] : [...base, "follows", "profile_visits"];
}
/** The smallest set every kind supports, for a retry when the full set is refused. */
export const BASIC_METRICS = ["reach", "likes", "comments", "saved", "shares", "total_interactions"];

export function mediaMetrics(items: InsightItem[] | undefined, fallback: { like_count?: number; comments_count?: number } = {}): IgMetrics {
  return {
    views: insightValue(items, "views"),
    reach: insightValue(items, "reach"),
    likes: insightValue(items, "likes") ?? num(fallback.like_count),
    comments: insightValue(items, "comments") ?? num(fallback.comments_count),
    shares: insightValue(items, "shares"),
    saves: insightValue(items, "saved"),
    interactions: insightValue(items, "total_interactions"),
    follows: insightValue(items, "follows"),
    profileVisits: insightValue(items, "profile_visits"),
    avgWatchMs: insightValue(items, "ig_reels_avg_watch_time"),
  };
}

export type DayTotals = {
  reach: number | null;
  views: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profileLinkTaps: number | null;
  follows: number | null;
  unfollows: number | null;
};

/** Account totals for one day: the main call plus the separate follows_and_unfollows call (100+ followers only). */
export function dayTotals(main: InsightItem[] | undefined, followItems?: InsightItem[]): DayTotals {
  // follow_type FOLLOWER = people who followed, NON_FOLLOWER = people who unfollowed (checked against the Instagram app in the live test).
  const fu = followItems?.find((i) => i.name === "follows_and_unfollows");
  const results = fu?.total_value?.breakdowns?.[0]?.results ?? [];
  const by = (key: string) => num(results.find((r) => r.dimension_values?.[0] === key)?.value);
  return {
    reach: insightValue(main, "reach"),
    views: insightValue(main, "views"),
    interactions: insightValue(main, "total_interactions"),
    likes: insightValue(main, "likes"),
    comments: insightValue(main, "comments"),
    shares: insightValue(main, "shares"),
    saves: insightValue(main, "saves"),
    profileLinkTaps: insightValue(main, "profile_links_taps"),
    follows: fu ? by("FOLLOWER") : null,
    unfollows: fu ? by("NON_FOLLOWER") : null,
  };
}

/** The token exchange answer is sometimes wrapped in `data: [...]`. */
export function tokenFrom(body: unknown): { accessToken: string; userId: string } | null {
  const b = body as { access_token?: string; user_id?: string | number; data?: { access_token?: string; user_id?: string | number }[] };
  const t = b?.access_token ? b : b?.data?.[0];
  return t?.access_token ? { accessToken: t.access_token, userId: String(t.user_id ?? "") } : null;
}

/** UTC midnight (unix seconds) for a yyyy-mm-dd day, and the next one. */
export function dayRange(date: string) {
  const since = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  return { since, until: since + 86_400 };
}
