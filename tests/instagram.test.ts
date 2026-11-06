import { test } from "node:test";
import assert from "node:assert/strict";
import { dayTotals, insightValue, kindOf, mediaMetrics, metricsFor, tokenFrom } from "../src/lib/instagram/parse.ts";
import { buildDashboard, engagementOf, periodFor, type IgDay, type IgPost } from "../src/lib/instagram/stats.ts";
import { demoData } from "../src/lib/instagram/demo.ts";

// Shapes as Meta returns them (Instagram API with Instagram Login), trimmed.
const mediaInsightsJson = {
  data: [
    { name: "views", period: "lifetime", values: [{ value: 5210 }], title: "Views", id: "1/insights/views/lifetime" },
    { name: "reach", period: "lifetime", values: [{ value: 3180 }], title: "Accounts reached" },
    { name: "likes", period: "lifetime", values: [{ value: 211 }] },
    { name: "comments", period: "lifetime", values: [{ value: 19 }] },
    { name: "shares", period: "lifetime", values: [{ value: 33 }] },
    { name: "saved", period: "lifetime", values: [{ value: 41 }] },
    { name: "total_interactions", period: "lifetime", values: [{ value: 304 }] },
    { name: "ig_reels_avg_watch_time", period: "lifetime", values: [{ value: 7350 }] },
  ],
};
const accountDayJson = {
  data: [
    { name: "reach", period: "day", total_value: { value: 1240 } },
    { name: "views", period: "day", total_value: { value: 2890 } },
    { name: "total_interactions", period: "day", total_value: { value: 96 } },
    { name: "likes", period: "day", total_value: { value: 70 } },
    { name: "comments", period: "day", total_value: { value: 6 } },
    { name: "shares", period: "day", total_value: { value: 9 } },
    { name: "saves", period: "day", total_value: { value: 11 } },
  ],
};
const followsJson = {
  data: [
    {
      name: "follows_and_unfollows",
      period: "day",
      total_value: { value: 31, breakdowns: [{ dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: 24 }, { dimension_values: ["NON_FOLLOWER"], value: 7 }] }] },
    },
  ],
};

test("media kinds: Reels, carousels and photos; stories and ads are left out", () => {
  assert.equal(kindOf({ media_type: "VIDEO", media_product_type: "REELS" }), "reel");
  assert.equal(kindOf({ media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" }), "carousel");
  assert.equal(kindOf({ media_type: "IMAGE", media_product_type: "FEED" }), "photo");
  assert.equal(kindOf({ media_type: "IMAGE", media_product_type: "STORY" }), null);
  assert.equal(kindOf({ media_type: "VIDEO", media_product_type: "AD" }), null);
  // Reels don't support per-post follows / profile visits; posts don't support watch time.
  assert.ok(!metricsFor("reel").includes("follows") && metricsFor("reel").includes("ig_reels_avg_watch_time"));
  assert.ok(metricsFor("carousel").includes("follows") && !metricsFor("carousel").includes("ig_reels_avg_watch_time"));
  assert.ok(!metricsFor("reel").some((m) => ["impressions", "plays", "video_views"].includes(m)), "no deprecated metrics");
});

test("post insights parse; metrics Instagram doesn't give stay null (never 0)", () => {
  const m = mediaMetrics(mediaInsightsJson.data);
  assert.deepEqual(
    [m.views, m.reach, m.likes, m.comments, m.shares, m.saves, m.interactions, m.avgWatchMs],
    [5210, 3180, 211, 19, 33, 41, 304, 7350],
  );
  assert.equal(m.follows, null);
  assert.equal(m.profileVisits, null);
  // Refused insights (empty) fall back to the like/comment counts from the media list.
  const fallback = mediaMetrics([], { like_count: 12, comments_count: 3 });
  assert.deepEqual([fallback.likes, fallback.comments, fallback.reach], [12, 3, null]);
  assert.equal(insightValue([{ name: "reach", total_value: { value: "15" } }], "reach"), 15);
});

test("daily account totals, with follows and unfollows when available", () => {
  const t = dayTotals(accountDayJson.data, followsJson.data);
  assert.deepEqual([t.reach, t.views, t.interactions, t.likes, t.shares, t.saves, t.follows, t.unfollows], [1240, 2890, 96, 70, 9, 11, 24, 7]);
  const small = dayTotals(accountDayJson.data, undefined); // under 100 followers: no follow data
  assert.deepEqual([small.follows, small.unfollows], [null, null]);
});

test("token exchange answers, plain or wrapped in data[]", () => {
  assert.deepEqual(tokenFrom({ access_token: "abc", user_id: 123 }), { accessToken: "abc", userId: "123" });
  assert.deepEqual(tokenFrom({ data: [{ access_token: "x", user_id: "9" }] }), { accessToken: "x", userId: "9" });
  assert.equal(tokenFrom({ error: "nope" }), null);
});

const day = (date: string, v: Partial<IgDay> = {}): IgDay => ({ date, followers: null, reach: null, views: null, interactions: null, likes: null, comments: null, shares: null, saves: null, follows: null, unfollows: null, ...v });
const post = (id: string, kind: IgPost["kind"], postedAt: string, reach: number, interactions: number): IgPost => ({
  mediaId: id,
  kind,
  caption: id,
  permalink: "",
  thumbnail: null,
  postedAt,
  metrics: { views: reach * 2, reach, likes: null, comments: null, shares: null, saves: null, interactions, follows: null, profileVisits: null, avgWatchMs: null },
});

test("periods end yesterday; custom ranges are checked", () => {
  assert.deepEqual(periodFor("7", "2026-11-06"), { range: "7", from: "2026-10-30", to: "2026-11-05" });
  assert.equal(periodFor(undefined, "2026-11-06").from, "2026-10-07");
  assert.deepEqual(periodFor("custom", "2026-11-06", "2026-10-01", "2026-10-10"), { range: "custom", from: "2026-10-01", to: "2026-10-10" });
  assert.equal(periodFor("custom", "2026-11-06", "bad", "2026-10-10").range, "30");
});

test("KPIs compare with the period before; engagement = interactions ÷ reach", () => {
  const days = [
    day("2026-10-25", { reach: 100, interactions: 10, followers: 1000 }),
    day("2026-10-26", { reach: 100, interactions: 10, followers: 1010 }),
    day("2026-10-27", { reach: 150, interactions: 30, followers: 1030 }),
    day("2026-10-28", { reach: 150, interactions: 30, followers: 1050 }),
  ];
  const d = buildDashboard({ posts: [], days, from: "2026-10-27", to: "2026-10-28" });
  const kpi = (k: string) => d.kpis.find((x) => x.key === k)!;
  assert.deepEqual([kpi("reach").value, kpi("reach").prev, kpi("reach").change], [300, 200, 50]);
  assert.equal(kpi("engagement").value, 20);
  assert.equal(kpi("followers").value, 1050);
  assert.equal(kpi("net").value, 20, "followers growth from our snapshots when Instagram gives no follows");
  assert.equal(kpi("unfollows").value, null, "not available stays null");
  assert.deepEqual(d.previous, { from: "2026-10-25", to: "2026-10-26" });
});

test("format comparison, top posts, heatmap and type filter", () => {
  const posts = [
    post("r1", "reel", "2026-10-27T17:00:00Z", 3000, 300),
    post("r2", "reel", "2026-10-28T17:00:00Z", 2000, 100),
    post("c1", "carousel", "2026-10-27T09:00:00Z", 1000, 150),
    post("c2", "carousel", "2026-10-28T09:00:00Z", 1000, 50),
    post("old", "photo", "2026-09-01T09:00:00Z", 9999, 9),
  ];
  const d = buildDashboard({ posts, days: [], from: "2026-10-27", to: "2026-10-28", tz: "Europe/Bucharest" });
  const reels = d.formats.find((f) => f.kind === "reel")!;
  assert.deepEqual([reels.posts, reels.reach], [2, 2500]);
  assert.equal(d.top[0].mediaId, "r1");
  assert.ok(!d.rows.some((r) => r.mediaId === "old"), "outside the period");
  assert.equal(d.heat[1][19], 3000, "Tuesday 17:00 UTC = 19:00 in Bucharest (winter time, UTC+2)");
  assert.equal(engagementOf(posts[2].metrics), 15);
  const onlyCarousels = buildDashboard({ posts, days: [], from: "2026-10-27", to: "2026-10-28", kind: "carousel" });
  assert.ok(onlyCarousels.rows.every((r) => r.kind === "carousel"));
  assert.ok(d.summary.some((s) => s.startsWith("Reels reach the most people")));
});

test("demo data is the same every time and clearly marked", () => {
  const a = demoData("2026-11-06");
  const b = demoData("2026-11-06");
  assert.deepEqual(a, b);
  assert.equal(a.days.length, 120);
  assert.ok(a.posts.length > 40 && a.posts.every((p) => p.mediaId.startsWith("demo-") && p.caption.includes("(demo post)")));
  const d = buildDashboard({ ...a, from: "2026-10-07", to: "2026-11-05" });
  assert.ok(d.kpis.find((k) => k.key === "reach")!.value! > 0 && d.summary.length >= 3);
});
