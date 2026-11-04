import "server-only";
import { gte } from "drizzle-orm";
import { getDb, schema } from "./db";
import { convertCents, rateOn, type Currency } from "./fx-math";

const ECB_90D = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
const ECB_ALL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml";
const FALLBACK = 5.0; // only if the ECB can't be reached and nothing is cached yet

let lastRefresh = 0;

/** Reads the ECB feed and stores every RON rate it has (shared cache). */
async function refresh(full: boolean) {
  const res = await fetch(full ? ECB_ALL : ECB_90D, { cache: "no-store" });
  if (!res.ok) throw new Error(`ECB ${res.status}`);
  const xml = await res.text();
  const rows: { date: string; ronPerEur: number }[] = [];
  for (const m of xml.matchAll(/<Cube time="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/Cube>/g)) {
    const ron = m[2].match(/currency="RON" rate="([\d.]+)"/);
    if (ron) rows.push({ date: m[1], ronPerEur: Number(ron[1]) });
  }
  if (!rows.length) return;
  const db = await getDb();
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(schema.fxRates).values(rows.slice(i, i + 500)).onConflictDoNothing();
  }
}

/**
 * A converter for amounts on any dates from `since` on: each entry uses its own date's ECB rate
 * (weekends use the Friday before). Fetches the ECB feed when the cache is missing recent days.
 */
export async function converter(since: string, to: Currency) {
  const db = await getDb();
  const load = () => db.select().from(schema.fxRates).where(gte(schema.fxRates.date, addDaysIso(since, -10)));
  let rows = await load();
  const newest = rows.reduce((d, r) => (r.date > d ? r.date : d), "");
  const today = new Date().toISOString().slice(0, 10);
  const stale = !newest || addDaysIso(newest, 4) < today;
  const missingOld = !rows.some((r) => r.date <= since);
  if ((stale || missingOld) && Date.now() - lastRefresh > 10 * 60_000) {
    lastRefresh = Date.now();
    try {
      await refresh(missingOld && since < addDaysIso(today, -85));
      rows = await load();
    } catch {
      // Keep going with what's cached (or the fallback).
    }
  }
  const rates = new Map(rows.map((r) => [r.date, r.ronPerEur]));
  const dates = [...rates.keys()].sort();
  return (cents: number, from: Currency, date: string) => convertCents(cents, from, to, rateOn(date, rates, dates) ?? FALLBACK);
}

function addDaysIso(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
