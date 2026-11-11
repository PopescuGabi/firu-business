import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ASSISTANT_NAME, PORTFOLIO_SITE } from "../brand";
import { getDb, schema } from "../db";
import { getSettings } from "../settings";
import { toHHMM } from "../time";
import { getWeek, nowMinutesIn, todayIn, toPlannerDays } from "../week";

/** What Jarvis knows about right now: a compact, read-only snapshot (no email bodies, no keys). */
export async function jarvisContext(uid: number) {
  const db = await getDb();
  const settings = await getSettings(uid);
  const today = todayIn(settings.timezone);
  const [{ days }, tasks, clients, leads] = await Promise.all([
    getWeek(uid, today, 7).catch(() => ({ days: [] as Awaited<ReturnType<typeof getWeek>>["days"] })),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, uid), eq(schema.tasks.done, false))).orderBy(asc(schema.tasks.due)).limit(25),
    db.select().from(schema.clients).where(and(eq(schema.clients.userId, uid), eq(schema.clients.archived, false))),
    db
      .select()
      .from(schema.leads)
      .where(and(eq(schema.leads.userId, uid), inArray(schema.leads.status, ["new", "drafted", "sent", "replied", "meeting"])))
      .limit(30),
  ]);
  const week = toPlannerDays(days).map((d) => ({
    date: d.date,
    busy: d.busy.map((b) => `${toHHMM(b.start)}–${toHHMM(b.end)} ${b.title}`),
  }));
  return {
    now: `${today} ${toHHMM(nowMinutesIn(settings.timezone))} (${settings.timezone})`,
    week,
    tasks: tasks.map((t) => ({ title: t.title, due: t.due, priority: t.priority, client: clients.find((c) => c.id === t.clientId)?.name ?? null })),
    clients: clients.map((c) => ({ name: c.name, type: c.businessType, about: c.description.slice(0, 200), features: c.features })),
    leads: leads
      .sort((a, b) => b.score - a.score)
      .map((l) => ({ business: l.business, niche: l.niche, city: l.city, fit: l.score, status: l.status, why: l.why.slice(0, 240) })),
  };
}

export function jarvisSystem(context: Awaited<ReturnType<typeof jarvisContext>>) {
  return `You are ${ASSISTANT_NAME}, the voice assistant inside Gabi Popescu's Dashboard. Gabi is 18, based in Craiova, Romania, and runs a small web, app and video business (his PFA is being registered; until it exists he does not sign contracts, invoice or take payments). His portfolio site is ${PORTFOLIO_SITE.url}.

How you answer:
- Your reply is spoken aloud. Keep it short: one to four sentences unless he asks for detail. No markdown, lists, emoji or links read out as symbols.
- Reply in the language he speaks (Romanian or English). Romanian text for clients is formal (dumneavoastră) with correct diacritics.
- Use the snapshot below for facts about his week, tasks, clients and leads. If something isn't in it, say you don't see it rather than guessing.
- You can't change anything in the app or send anything. If he asks you to message a client, draft it for him to send himself, and never include demo links in a first message; ask for a call or a meeting instead.
- Be direct and practical, like a sharp chief of staff.

Snapshot (read-only):
${JSON.stringify(context)}`;
}
