import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { ASSISTANT_NAME, PORTFOLIO_SITE } from "../brand";
import { getDb, schema } from "../db";
import { LEAD_STATUSES, type LeadStatus } from "../db/schema";
import { gmailConnected, listInbox } from "../google/gmail";
import { getSettings } from "../settings";
import { toHHMM } from "../time";
import { getWeek, nowMinutesIn, todayIn, toPlannerDays } from "../week";

/** What Jarvis knows right now: a compact, read-only snapshot (sender and subject only for mail, never bodies or keys). */
export async function jarvisContext(uid: number, modules: string[]) {
  const db = await getDb();
  const settings = await getSettings(uid);
  const today = todayIn(settings.timezone);
  const wantsMail = modules.includes("email") && (await gmailConnected(uid).catch(() => false));
  const [{ days }, tasks, clients, leads, inbox] = await Promise.all([
    getWeek(uid, today, 7).catch(() => ({ days: [] as Awaited<ReturnType<typeof getWeek>>["days"] })),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, uid), eq(schema.tasks.done, false))).orderBy(asc(schema.tasks.due)).limit(25),
    db.select().from(schema.clients).where(and(eq(schema.clients.userId, uid), eq(schema.clients.archived, false))),
    db
      .select()
      .from(schema.leads)
      .where(and(eq(schema.leads.userId, uid), inArray(schema.leads.status, ["new", "drafted", "sent", "replied", "meeting"])))
      .limit(30),
    wantsMail
      ? listInbox(uid, { max: 8, q: "in:inbox is:unread newer_than:4d -category:promotions -category:social -category:updates" }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const week = toPlannerDays(days).map((d) => ({
    date: d.date,
    busy: d.busy.map((b) => `${toHHMM(b.start)}–${toHHMM(b.end)} ${b.title}${b.kind === "calendar" ? "" : ` (${b.kind})`}`),
  }));
  const staleDays = 4;
  return {
    now: `${today} ${toHHMM(nowMinutesIn(settings.timezone))} (${settings.timezone})`,
    week,
    tasks: tasks.map((t) => ({ title: t.title, due: t.due, priority: ["low", "normal", "high"][t.priority] ?? "normal", client: clients.find((c) => c.id === t.clientId)?.name ?? null })),
    clients: clients.map((c) => ({ name: c.name, type: c.businessType, about: c.description.slice(0, 160) })),
    leads: leads
      .sort((a, b) => b.score - a.score)
      .map((l) => ({
        business: l.business,
        niche: l.niche,
        fit: l.score,
        status: l.status,
        waitingOnReply: l.status === "sent" && Date.now() - l.updatedAt.getTime() > staleDays * 86_400_000,
        why: l.why.slice(0, 200),
      })),
    unreadMail: inbox === null ? (wantsMail ? "could not load" : "Gmail not connected") : inbox.map((m) => ({ from: m.from, subject: m.subject })),
  };
}

export function jarvisSystem(context: Awaited<ReturnType<typeof jarvisContext>>, briefing: boolean) {
  return `You are ${ASSISTANT_NAME}, the voice assistant built into Gabi Popescu's Dashboard. Gabi is 18, lives in Craiova, Romania, and runs a small business building websites, apps and video edits. His PFA is still being registered, so until it exists he doesn't sign contracts, invoice or take payments. His portfolio is ${PORTFOLIO_SITE.url}.

Character: a composed British butler-assistant in the spirit of a film AI. Calm, precise, quietly proactive, with dry, understated wit, used lightly and never at the expense of being useful. You take initiative ("I've gone ahead and…") and finish with a nudge toward the next useful step. Call him "sir" now and then, not in every sentence.

How you speak:
- Everything you write is read aloud. Keep it brief: one to four sentences unless he asks for more. No markdown, lists, bullet symbols, emoji or URLs.
- Answer in the language he uses. In Romanian, keep the same calm, witty tone, with correct diacritics. Anything written for a client is formal Romanian (dumneavoastră).
- Times as people say them ("at eleven", "at quarter past one").
- Facts about his week, tasks, clients, leads and mail come only from the snapshot or your tools. If something isn't there, say so plainly.

What you can do (tools): plan today's free time into work blocks (plan_day), add a task (add_task), and record where a lead stands (set_lead_status). Use them when he asks, or when the moment obviously calls for it. Confirm what you did in one short clause. You cannot send messages or emails. If he wants to contact someone, draft it for him to send himself, and never put demo links in a first message to a client; ask for a call or a meeting instead.
${
  briefing
    ? `
This is the morning briefing. Before speaking, call plan_day once so his free time is organised. Then, in this order and briefly: a greeting that suits the time of day; what you've organised; the day's fixed commitments with times; anything urgent (tasks due today or overdue, unread mail worth answering, leads waiting on a reply); and one line steering him into the first block of focused work. Keep it under about 120 words.`
    : ""
}
Snapshot (read-only, as of now):
${JSON.stringify(context)}`;
}

/* ---------- tools ---------- */

export const JARVIS_TOOLS = [
  {
    name: "plan_day",
    description:
      "Organise the rest of today: fills Gabi's free time with proposed work blocks for his open tasks (shown in Today and Calendar as proposals). Returns today's resulting schedule.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "add_task",
    description: "Add a task to Gabi's task list.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short imperative title, in the language he used." },
        due: { type: "string", description: "Due date as YYYY-MM-DD, if he gave one." },
        priority: { type: "string", enum: ["low", "normal", "high"] },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "set_lead_status",
    description: "Record where a lead stands (for example after Gabi sent the message himself or got a reply). Never sends anything.",
    input_schema: {
      type: "object" as const,
      properties: {
        business: { type: "string", description: "The lead's business name, as in the snapshot." },
        status: { type: "string", enum: [...LEAD_STATUSES] },
      },
      required: ["business", "status"],
      additionalProperties: false,
    },
  },
];

export type ToolOutcome = { result: string; action?: string };

/** Runs one tool. `planDay` is passed in because it calls the planner route on the user's own session. */
export async function runJarvisTool(uid: number, name: string, input: Record<string, unknown>, planDay: () => Promise<string>): Promise<ToolOutcome> {
  const db = await getDb();
  if (name === "plan_day") {
    const result = await planDay();
    return { result, action: "Organised today's free time" };
  }
  if (name === "add_task") {
    const title = String(input.title ?? "").trim().slice(0, 200);
    if (!title) return { result: "No title given; nothing added." };
    const due = typeof input.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : null;
    const priority = { low: 0, normal: 1, high: 2 }[String(input.priority ?? "normal")] ?? 1;
    await db.insert(schema.tasks).values({ userId: uid, title, due, priority });
    return { result: `Added task "${title}"${due ? ` due ${due}` : ""}.`, action: `Task added: ${title}` };
  }
  if (name === "set_lead_status") {
    const status = String(input.status ?? "") as LeadStatus;
    if (!LEAD_STATUSES.includes(status)) return { result: "Unknown status; nothing changed." };
    const business = String(input.business ?? "").trim();
    const rows = await db
      .update(schema.leads)
      .set({ status, updatedAt: sql`now()` })
      .where(and(eq(schema.leads.userId, uid), sql`lower(${schema.leads.business}) = lower(${business})`))
      .returning({ business: schema.leads.business });
    if (!rows.length) return { result: `No lead called "${business}" found; nothing changed.` };
    return { result: `${rows[0].business} is now "${status}".`, action: `${rows[0].business}: ${status}` };
  }
  return { result: `Unknown tool ${name}.` };
}

/** Today's schedule after planning, as a short text for the model. */
export async function todaySchedule(uid: number) {
  const settings = await getSettings(uid);
  const today = todayIn(settings.timezone);
  const { days } = await getWeek(uid, today, 1);
  const [d] = toPlannerDays(days);
  if (!d || d.busy.length === 0) return "Nothing scheduled today.";
  return d.busy
    .filter((b) => b.kind !== "past")
    .map((b) => `${toHHMM(b.start)}–${toHHMM(b.end)} ${b.title}${b.kind === "calendar" ? "" : ` (${b.kind})`}`)
    .join("; ");
}
