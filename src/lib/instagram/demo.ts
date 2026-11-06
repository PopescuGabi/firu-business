// Pure: a believable, clearly-labelled DEMO account so the dashboard can be shown before Instagram is connected.
// Generated on the fly from a fixed seed (the same every time), never stored and never mixed with real data.
import type { IgDay, IgPost } from "./stats.ts";
import type { IgKind } from "./parse.ts";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOPICS = ["Client results", "Behind the scenes", "3 marketing mistakes", "Case study", "How we plan a launch", "Q&A", "Team day", "Before / after", "Tips for founders", "Tool we use daily"];

export const DEMO_ACCOUNT = { username: "demo.account", name: "Demo account", picture: null as string | null, demo: true as const };

/** 120 days of demo data ending `today` (yyyy-mm-dd). */
export function demoData(today: string): { posts: IgPost[]; days: IgDay[] } {
  const r = rng(20261106);
  const start = Date.parse(`${today}T12:00:00Z`) - 119 * 86_400_000;
  const posts: IgPost[] = [];
  let followers = 4_820;
  const days: IgDay[] = [];
  let next = 0;
  for (let i = 0; i < 120; i++) {
    const day = new Date(start + i * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    // A post every 1–3 days, a bit more often lately; Reels most often.
    if (i >= next && i < 119) {
      const roll = r();
      const kind: IgKind = roll < 0.5 ? "reel" : roll < 0.8 ? "carousel" : "photo";
      const base = kind === "reel" ? 2600 : kind === "carousel" ? 1500 : 850;
      const reach = Math.round(base * (0.45 + r() * 1.4) * (1 + i / 300));
      const likes = Math.round(reach * (0.04 + r() * 0.05));
      const comments = Math.round(likes * (0.05 + r() * 0.1));
      const shares = Math.round(reach * (kind === "reel" ? 0.01 + r() * 0.02 : 0.004 + r() * 0.01));
      const saves = Math.round(reach * (kind === "carousel" ? 0.02 + r() * 0.03 : 0.005 + r() * 0.012));
      const hour = [8, 12, 13, 18, 19, 20][Math.floor(r() * 6)];
      posts.push({
        mediaId: `demo-${i}`,
        kind,
        caption: `${TOPICS[Math.floor(r() * TOPICS.length)]} (demo post)`,
        permalink: "",
        thumbnail: null,
        postedAt: new Date(Date.parse(`${date}T${String(hour - 2).padStart(2, "0")}:00:00Z`)).toISOString(),
        metrics: {
          views: Math.round(reach * (kind === "reel" ? 1.5 + r() : 1.1 + r() * 0.4)),
          reach,
          likes,
          comments,
          shares,
          saves,
          interactions: likes + comments + shares + saves,
          follows: kind === "reel" ? null : Math.round(reach * 0.002 * r()),
          profileVisits: kind === "reel" ? null : Math.round(reach * 0.01 * r()),
          avgWatchMs: kind === "reel" ? Math.round(4000 + r() * 9000) : null,
        },
      });
      next = i + 1 + Math.floor(r() * (i > 80 ? 2 : 3));
    }
    const recent = posts.filter((p) => {
      const age = (day.getTime() - Date.parse(p.postedAt)) / 86_400_000;
      return age >= 0 && age < 3;
    });
    const reach = Math.round(700 + r() * 300 + recent.reduce((s, p) => s + (p.metrics.reach ?? 0) * 0.35, 0));
    const interactions = Math.round(reach * (0.05 + r() * 0.03));
    const follows = Math.round(8 + r() * 14 + recent.length * 6);
    const unfollows = Math.round(4 + r() * 8);
    followers += follows - unfollows;
    days.push({
      date,
      followers,
      reach,
      views: Math.round(reach * (1.7 + r() * 0.6)),
      interactions,
      likes: Math.round(interactions * 0.72),
      comments: Math.round(interactions * 0.08),
      shares: Math.round(interactions * 0.09),
      saves: Math.round(interactions * 0.11),
      follows,
      unfollows,
    });
  }
  return { posts, days };
}
