import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ASSISTANT_NAME, PORTFOLIO_SITE } from "../brand";
import { getDb, schema } from "../db";
import { LEAD_STATUSES, type LeadStatus } from "../db/schema";
import { requestSync } from "../calendar-sync";
import { deleteEvent, getEvent, insertEvent, listCalendars, listEvents, patchEvent, type EventBody } from "../google/calendar";
import { gmailConnected, listInbox } from "../google/gmail";
import { getSettings } from "../settings";
import { addDays, toHHMM } from "../time";
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

What you can do (tools): you run his schedule. You can list, add, move, rename and delete Google Calendar events (list_events first when you need an event's id); plan the rest of today into work blocks, then accept or clear that plan; add tasks and complete, reschedule, re-prioritise or rename them; and record where a lead stands. Act when he asks, without asking permission for ordinary changes, and confirm what you did in one short clause. Before deleting anything, make sure he clearly asked for it. If a request is ambiguous (two events could match, no time given for a meeting), ask one short question instead of guessing. Resolve relative dates ("tomorrow", "next Friday", "mâine") from the current date in the snapshot.
- His words come from speech recognition, so read for meaning: an odd word is probably a mishearing (for example "shower" when food or a place makes more sense could be "shawarma"). Use the likely meaning, and only check when it matters.
- You cannot send messages or emails. If he wants to contact someone, draft it for him to send himself, and never put demo links in a first message to a client; ask for a call or a meeting instead.
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

const str = { type: "string" as const };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object" as const, properties, required, additionalProperties: false });

export const JARVIS_TOOLS = [
  {
    name: "list_events",
    description:
      "List Google Calendar events between two dates (inclusive), with their ids. Use before changing or deleting an event, or to answer questions beyond the snapshot.",
    input_schema: obj({ from: { ...str, description: "YYYY-MM-DD" }, to: { ...str, description: "YYYY-MM-DD" } }, ["from", "to"]),
  },
  {
    name: "add_event",
    description: "Add an event to Gabi's Google Calendar (his main calendar).",
    input_schema: obj(
      {
        title: str,
        date: { ...str, description: "YYYY-MM-DD" },
        start: { ...str, description: "HH:MM, 24-hour. Omit for an all-day event." },
        end: { ...str, description: "HH:MM. Defaults to one hour after start." },
        location: str,
        notes: str,
      },
      ["title", "date"],
    ),
  },
  {
    name: "update_event",
    description: "Change an existing calendar event: rename it, or move it to another date or time. Get its id from list_events first.",
    input_schema: obj(
      {
        id: { ...str, description: "The id from list_events" },
        title: str,
        date: { ...str, description: "New date YYYY-MM-DD" },
        start: { ...str, description: "New start HH:MM" },
        end: { ...str, description: "New end HH:MM" },
        location: str,
      },
      ["id"],
    ),
  },
  {
    name: "delete_event",
    description: "Delete a calendar event. Only after Gabi has clearly asked for it or confirmed it.",
    input_schema: obj({ id: { ...str, description: "The id from list_events" } }, ["id"]),
  },
  {
    name: "plan_day",
    description:
      "Organise the rest of today: fills free time with proposed work blocks for open tasks (shown in Today and Calendar as proposals). Returns today's schedule.",
    input_schema: obj({}),
  },
  {
    name: "accept_plan",
    description: "Accept today's proposed work blocks, so they become real blocks (and go to his Google calendar when sync is on).",
    input_schema: obj({}),
  },
  {
    name: "clear_plan",
    description: "Remove the proposed work blocks that haven't been accepted.",
    input_schema: obj({}),
  },
  {
    name: "add_task",
    description: "Add a task to Gabi's task list.",
    input_schema: obj(
      {
        title: { ...str, description: "Short imperative title, in the language he used." },
        due: { ...str, description: "YYYY-MM-DD, if he gave one" },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        minutes: { type: "integer", description: "Estimated minutes, if known" },
      },
      ["title"],
    ),
  },
  {
    name: "update_task",
    description: "Change an open task, found by (part of) its title: mark it done, reschedule it, re-prioritise or rename it.",
    input_schema: obj(
      {
        match: { ...str, description: "Words from the task's title" },
        done: { type: "boolean" },
        due: { ...str, description: "New due date YYYY-MM-DD" },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        title: { ...str, description: "New title" },
      },
      ["match"],
    ),
  },
  {
    name: "set_lead_status",
    description: "Record where a lead stands (for example after Gabi sent the message himself or got a reply). Never sends anything.",
    input_schema: obj({ business: { ...str, description: "The lead's business name" }, status: { type: "string", enum: [...LEAD_STATUSES] } }, ["business", "status"]),
  },
];

export type ToolOutcome = { result: string; action?: string };
type Ctx = { uid: number; tz: string; planDay: () => Promise<string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad = (t: string) => (t.length === 4 ? `0${t}` : t);
const plusHour = (t: string) => {
  const [h, m] = pad(t).split(":").map(Number);
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const ref = (calendarId: string, id: string) => `${calendarId}::${id}`;
const unref = (r: string) => {
  const k = r.lastIndexOf("::");
  if (k < 0) throw new Error("That event id isn't one from list_events.");
  return { calendarId: r.slice(0, k), eventId: r.slice(k + 2) };
};

async function mainCalendar(uid: number) {
  const cals = (await listCalendars(uid)).filter((c) => c.writable);
  const cal = cals.find((c) => c.primary) ?? cals[0];
  if (!cal) throw new Error("No Google calendar he can write to. Connect Google in Settings.");
  return cal;
}

async function writable(uid: number, calendarId: string) {
  if (!(await listCalendars(uid)).some((c) => c.id === calendarId && c.writable)) throw new Error("That calendar is read-only.");
}

const touched = () => {
  revalidatePath("/", "layout");
};

/** Runs one tool for Jarvis. Each change is something Gabi asked for in the conversation. */
export async function runJarvisTool(name: string, input: Record<string, unknown>, ctx: Ctx): Promise<ToolOutcome> {
  const { uid, tz } = ctx;
  const db = await getDb();
  const s = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : "");

  switch (name) {
    case "list_events": {
      const from = s("from");
      const to = s("to");
      if (!DATE.test(from) || !DATE.test(to)) return { result: "Dates must be YYYY-MM-DD." };
      const settings = await getSettings(uid);
      const events = await listEvents(uid, new TZDate(`${from}T00:00:00`, tz), new TZDate(`${addDays(to, 1)}T00:00:00`, tz), settings.calendarIds);
      if (!events.length) return { result: "No events in that range." };
      return {
        result: events
          .slice(0, 60)
          .map((e) => {
            const when = e.allDay ? `${e.start} all day` : `${format(new TZDate(e.start, tz), "yyyy-MM-dd HH:mm")}–${format(new TZDate(e.end, tz), "HH:mm")}`;
            return `[${ref(e.calendarId, e.id)}] ${when} ${e.title}${e.writable ? "" : " (read-only)"}`;
          })
          .join("\n"),
      };
    }
    case "add_event": {
      const title = s("title").slice(0, 200);
      const date = s("date");
      if (!title || !DATE.test(date)) return { result: "Need a title and a date (YYYY-MM-DD)." };
      const start = s("start");
      const end = s("end");
      const cal = await mainCalendar(uid);
      const body = { summary: title, location: s("location"), description: s("notes") } as EventBody;
      if (start && TIME.test(start)) {
        const e = end && TIME.test(end) ? pad(end) : plusHour(start);
        const endDate = e <= pad(start) ? addDays(date, 1) : date;
        body.start = { dateTime: `${date}T${pad(start)}:00`, timeZone: tz };
        body.end = { dateTime: `${endDate}T${e}:00`, timeZone: tz };
      } else {
        body.start = { date };
        body.end = { date: addDays(date, 1) };
      }
      await insertEvent(uid, cal.id, body);
      touched();
      const when = start ? `${date} at ${pad(start)}` : `${date}, all day`;
      return { result: `Added "${title}" on ${when} to ${cal.name}.`, action: `Event added: ${title}, ${when}` };
    }
    case "update_event": {
      const { calendarId, eventId } = unref(s("id"));
      await writable(uid, calendarId);
      const current = await getEvent(uid, calendarId, eventId);
      const patch: EventBody = {} as EventBody;
      if (s("title")) patch.summary = s("title").slice(0, 200);
      if (s("location")) patch.location = s("location");
      const date = s("date");
      const start = s("start");
      const end = s("end");
      if (date || start || end) {
        if (current.start.date) {
          // All-day event: only the date moves (keeping its length).
          const d = DATE.test(date) ? date : current.start.date;
          const days = Math.max(1, Math.round((Date.parse(current.end.date!) - Date.parse(current.start.date)) / 86_400_000));
          if (start && TIME.test(start)) {
            patch.start = { dateTime: `${d}T${pad(start)}:00`, timeZone: tz };
            patch.end = { dateTime: `${d}T${end && TIME.test(end) ? pad(end) : plusHour(start)}:00`, timeZone: tz };
          } else {
            patch.start = { date: d };
            patch.end = { date: addDays(d, days) };
          }
        } else {
          const s0 = new TZDate(current.start.dateTime!, tz);
          const e0 = new TZDate(current.end.dateTime!, tz);
          const lengthMin = Math.max(5, Math.round((e0.getTime() - s0.getTime()) / 60_000));
          const d = DATE.test(date) ? date : format(s0, "yyyy-MM-dd");
          const st = start && TIME.test(start) ? pad(start) : format(s0, "HH:mm");
          let en: string;
          let endDate = d;
          if (end && TIME.test(end)) en = pad(end);
          else {
            const t = new Date(Date.parse(`${d}T${st}:00Z`) + lengthMin * 60_000);
            en = t.toISOString().slice(11, 16);
            endDate = t.toISOString().slice(0, 10);
          }
          if (endDate === d && en <= st) endDate = addDays(d, 1);
          patch.start = { dateTime: `${d}T${st}:00`, timeZone: tz };
          patch.end = { dateTime: `${endDate}T${en}:00`, timeZone: tz };
        }
      }
      if (!Object.keys(patch).length) return { result: "Nothing to change." };
      await patchEvent(uid, calendarId, eventId, patch);
      touched();
      const label = patch.summary ?? current.summary ?? "the event";
      return { result: `Updated "${label}".`, action: `Event updated: ${label}` };
    }
    case "delete_event": {
      const { calendarId, eventId } = unref(s("id"));
      await writable(uid, calendarId);
      const current = await getEvent(uid, calendarId, eventId).catch(() => null);
      await deleteEvent(uid, calendarId, eventId);
      touched();
      const label = current?.summary ?? "the event";
      return { result: `Deleted "${label}".`, action: `Event deleted: ${label}` };
    }
    case "plan_day": {
      const result = await ctx.planDay();
      return { result, action: "Organised today's free time" };
    }
    case "accept_plan": {
      const today = todayIn(tz);
      const rows = await db
        .update(schema.planBlocks)
        .set({ status: "accepted" })
        .where(and(eq(schema.planBlocks.userId, uid), eq(schema.planBlocks.status, "proposed"), eq(schema.planBlocks.date, today)))
        .returning({ id: schema.planBlocks.id });
      touched();
      requestSync(uid);
      return { result: `Accepted ${rows.length} block(s).`, action: rows.length ? `Accepted ${rows.length} plan block(s)` : undefined };
    }
    case "clear_plan": {
      const rows = await db
        .delete(schema.planBlocks)
        .where(and(eq(schema.planBlocks.userId, uid), eq(schema.planBlocks.status, "proposed")))
        .returning({ id: schema.planBlocks.id });
      touched();
      return { result: `Removed ${rows.length} proposed block(s).`, action: rows.length ? "Cleared the proposed plan" : undefined };
    }
    case "add_task": {
      const title = s("title").slice(0, 200);
      if (!title) return { result: "No title given; nothing added." };
      const due = DATE.test(s("due")) ? s("due") : null;
      const priority = { low: 0, normal: 1, high: 2 }[s("priority") || "normal"] ?? 1;
      const minutes = typeof input.minutes === "number" ? Math.min(600, Math.max(5, Math.round(input.minutes))) : 30;
      await db.insert(schema.tasks).values({ userId: uid, title, due, priority, estimateMin: minutes });
      touched();
      requestSync(uid);
      return { result: `Added task "${title}"${due ? ` due ${due}` : ""}.`, action: `Task added: ${title}` };
    }
    case "update_task": {
      const match = s("match").toLowerCase();
      if (!match) return { result: "Say which task." };
      const open = await db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, uid), eq(schema.tasks.done, false)));
      const hits = open.filter((t) => t.title.toLowerCase().includes(match));
      if (hits.length === 0) return { result: `No open task matches "${match}". Open tasks: ${open.map((t) => t.title).slice(0, 15).join("; ") || "none"}.` };
      if (hits.length > 1) return { result: `Several tasks match: ${hits.map((t) => t.title).join("; ")}. Ask which one.` };
      const t = hits[0];
      const patch: Partial<typeof schema.tasks.$inferInsert> = {};
      if (input.done === true) patch.done = true;
      if (DATE.test(s("due"))) patch.due = s("due");
      if (s("priority")) patch.priority = { low: 0, normal: 1, high: 2 }[s("priority")] ?? t.priority;
      if (s("title")) patch.title = s("title").slice(0, 200);
      if (!Object.keys(patch).length) return { result: "Nothing to change." };
      await db.update(schema.tasks).set(patch).where(and(eq(schema.tasks.id, t.id), eq(schema.tasks.userId, uid)));
      touched();
      requestSync(uid);
      const what = patch.done ? "done" : patch.due ? `moved to ${patch.due}` : "updated";
      return { result: `"${t.title}" ${what}.`, action: `Task ${what}: ${t.title}` };
    }
    case "set_lead_status": {
      const status = s("status") as LeadStatus;
      if (!LEAD_STATUSES.includes(status)) return { result: "Unknown status; nothing changed." };
      const business = s("business");
      const rows = await db
        .update(schema.leads)
        .set({ status, updatedAt: sql`now()` })
        .where(and(eq(schema.leads.userId, uid), sql`lower(${schema.leads.business}) like lower(${"%" + business + "%"})`))
        .returning({ business: schema.leads.business });
      if (!rows.length) return { result: `No lead called "${business}" found; nothing changed.` };
      touched();
      return { result: `${rows.map((r) => r.business).join(", ")} now "${status}".`, action: `${rows[0].business}: ${status}` };
    }
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
