import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { and, eq, gte } from "drizzle-orm";
import { getUser } from "./auth";
import { getDb, schema } from "./db";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|curl|wget|python|headless|lighthouse/i;

/**
 * Counts a visit to a public portfolio page, after the page is sent. Stores only the day and the
 * referring site's host; no IP address, no cookies. Bots, link previews and your own visits don't count.
 */
export async function recordShareView(ownerId: number, itemId: number | null) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (!ua || BOT.test(ua) || h.get("purpose") === "prefetch" || h.get("next-router-prefetch")) return;
  const ref = h.get("referer") ?? "";
  let referrer = "";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "").replace(/^l\./, "").replace(/^m\./, "");
    if (!host.endsWith("vercel.app") && host !== "localhost") referrer = host.slice(0, 100);
  } catch {}
  if ((await getUser())?.id === ownerId) return; // request data can't be read inside after() on a page
  after(async () => {
    const db = await getDb();
    await db.insert(schema.shareViews).values({ userId: ownerId, itemId, day: new Date().toISOString().slice(0, 10), referrer });
  });
}

/** Visits to your share pages in the last 30 days: per day, most-opened items, where people came from. */
export async function shareStats(uid: number) {
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const db = await getDb();
  const rows = await db.select().from(schema.shareViews).where(and(eq(schema.shareViews.userId, uid), gte(schema.shareViews.day, since)));
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10));
  const tally = <K,>(key: (r: (typeof rows)[number]) => K) => {
    const m = new Map<K, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  return {
    total: rows.length,
    days,
    perDay: days.map((d) => rows.filter((r) => r.day === d).length),
    items: tally((r) => r.itemId).filter(([k]) => k !== null) as [number, number][],
    sources: tally((r) => r.referrer || "Direct / typed").slice(0, 6),
  };
}
