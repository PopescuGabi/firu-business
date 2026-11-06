import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { syncIfStale } from "./calendar-sync";
import { MARK as SYNC_MARK } from "./calendar-sync/model";
import { getDb, schema } from "./db";
import { getSettings } from "./settings";
import { listEvents, type CalendarEvent } from "./google/calendar";
import { getGoogleAccount } from "./google/oauth";
import { addDays, toMin, weekdayOf } from "./time";
import { placeOf, type DayContext } from "./planner";
import { fixedClashes, knownPlace, travelTime, type Clash, type PlacedItem } from "./travel";

// startMin/endMin are clipped to this day (0–1440); label shows the real times, e.g. "22:00–00:00".
export type DayEvent = CalendarEvent & { date: string; startMin: number; endMin: number; label: string; place: string | null };
export type DayView = {
  date: string;
  weekday: number;
  events: DayEvent[];
  allDay: CalendarEvent[];
  blocks: (typeof schema.planBlocks.$inferSelect)[];
  // Fixed sessions too close together for the travel between them.
  clashes: Clash[];
};

export function todayIn(tz: string) {
  return format(new TZDate(new Date(), tz), "yyyy-MM-dd");
}

export function nowMinutesIn(tz: string) {
  const d = new TZDate(new Date(), tz);
  return d.getHours() * 60 + d.getMinutes();
}

export async function getWeek(uid: number, weekStart: string, numDays = 7) {
  await syncIfStale(uid); // in the background, after the page is sent
  const db = await getDb();
  const settings = await getSettings(uid);
  const tz = settings.timezone;
  const dates = Array.from({ length: numDays }, (_, i) => addDays(weekStart, i));
  const last = dates[dates.length - 1];

  const [blocks, account] = await Promise.all([
    db
      .select()
      .from(schema.planBlocks)
      .where(and(eq(schema.planBlocks.userId, uid), gte(schema.planBlocks.date, weekStart), lte(schema.planBlocks.date, last)))
      .orderBy(asc(schema.planBlocks.start)),
    getGoogleAccount(uid),
  ]);
  // Events the hub writes to its own Google calendar (shown as plans and tasks instead).
  const mirrored = new Set(
    (await db.select({ id: schema.calendarLinks.eventId }).from(schema.calendarLinks).where(eq(schema.calendarLinks.userId, uid))).map((r) => r.id),
  );

  let events: CalendarEvent[] = [];
  let calendarError: string | null = null;
  const googleConnected = Boolean(account?.accessToken);
  if (googleConnected) {
    try {
      const from = new TZDate(`${weekStart}T00:00:00`, tz);
      const to = new TZDate(`${addDays(last, 1)}T00:00:00`, tz);
      events = await listEvents(uid, from, to, settings.calendarIds);
    } catch (err) {
      calendarError = err instanceof Error ? err.message : "Could not load Google Calendar";
    }
  }

  const views: DayView[] = dates.map((date) => {
    const weekday = weekdayOf(date);
    const timed: DayEvent[] = [];
    const allDay: CalendarEvent[] = [];
    for (const e of events) {
      if (mirrored.has(e.id) || (e.recurringEventId && mirrored.has(e.recurringEventId)) || e.description.includes(SYNC_MARK)) continue;
      if (e.allDay) {
        if (e.start <= date && date < e.end) allDay.push(e);
        continue;
      }
      const s = new TZDate(e.start, tz);
      const en = new TZDate(e.end, tz);
      const sDate = format(s, "yyyy-MM-dd");
      const eDate = format(en, "yyyy-MM-dd");
      if (sDate > date || eDate < date) continue;
      const startMin = sDate < date ? 0 : s.getHours() * 60 + s.getMinutes();
      const endMin = eDate > date ? 24 * 60 : en.getHours() * 60 + en.getMinutes();
      if (sDate < date && endMin === 0) continue; // ended at midnight, nothing left on this day
      const end = eDate === sDate || eDate === addDays(sDate, 1) ? format(en, "HH:mm") : format(en, "EEE HH:mm");
      timed.push({
        ...e,
        date,
        startMin,
        endMin,
        label: `${format(s, sDate < date ? "EEE HH:mm" : "HH:mm")}–${end}`,
        place: knownPlace(e.location, settings.travel),
      });
    }
    const fixed: PlacedItem[] = [
      ...timed.filter((e) => e.place).map((e) => ({ start: e.startMin, end: e.endMin, place: e.place!, title: e.title })),
      ...blocks
        .filter((b) => b.date === date && b.status === "accepted")
        .map((b) => ({ start: toMin(b.start), end: toMin(b.end), place: placeOf(b.kind), title: b.title })),
    ];
    return {
      date,
      weekday,
      events: timed.sort((a, b) => a.startMin - b.startMin),
      allDay,
      blocks: blocks.filter((b) => b.date === date),
      clashes: fixedClashes(fixed, settings.travel, placeLabel),
    };
  });

  return { days: views, settings, calendarError, googleConnected };
}

/** What the planner must work around: calendar events and accepted blocks. */
export function toPlannerDays(days: DayView[]): DayContext[] {
  return days.map((d) => {
    const busy: DayContext["busy"] = [];
    for (const e of d.events) busy.push({ start: e.startMin, end: e.endMin, title: e.title, kind: "calendar", place: e.place ?? "any" });
    for (const b of d.blocks) {
      if (b.status === "accepted") busy.push({ start: toMin(b.start), end: toMin(b.end), title: b.title, kind: b.kind, place: placeOf(b.kind) });
    }
    return { date: d.date, weekday: d.weekday, busy };
  });
}

/** All suggestions not yet accepted, across every week (what "Clear suggestions" removes). */
export async function countSuggestions(uid: number) {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.planBlocks.id })
    .from(schema.planBlocks)
    .where(and(eq(schema.planBlocks.userId, uid), eq(schema.planBlocks.status, "proposed")));
  return rows.length;
}

export const placeLabel = (p: string) => (p === "online" ? "online" : p === "any" ? "an event" : p);
