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
import { addDays, schoolPeriods, toMin, weekdayOf, type Interval } from "./time";
import { occursOn } from "./tutoring";
import { placeOf, type DayContext } from "./planner";
import { fixedClashes, knownPlace, travelTime, type Clash, type PlacedItem } from "./travel";

// startMin/endMin are clipped to this day (0–1440); label shows the real times, e.g. "22:00–00:00".
export type DayEvent = CalendarEvent & { date: string; startMin: number; endMin: number; label: string; place: string | null };
export type ClassSlot = Interval & { subject: string };
export type DayView = {
  date: string;
  weekday: number;
  school: ClassSlot[];
  gym: (typeof schema.gymDays.$inferSelect) | null;
  // Set when this day's gym has a fixed time (e.g. right after school); otherwise the planner picks it.
  gymFixed: Interval | null;
  events: DayEvent[];
  allDay: CalendarEvent[];
  blocks: (typeof schema.planBlocks.$inferSelect)[];
  tutoring: (typeof schema.tutoring.$inferSelect)[];
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

export async function getSchool() {
  const db = await getDb();
  const [days, classes] = await Promise.all([
    db.select().from(schema.schoolDays),
    db.select().from(schema.schoolClasses).orderBy(asc(schema.schoolClasses.period)),
  ]);
  return { days, classes };
}

export async function getWeek(weekStart: string, numDays = 7) {
  await syncIfStale(); // pick up edits made in Google Calendar first
  const db = await getDb();
  const settings = await getSettings();
  const tz = settings.timezone;
  const dates = Array.from({ length: numDays }, (_, i) => addDays(weekStart, i));
  const last = dates[dates.length - 1];

  const [{ days: schoolDays, classes }, gym, blocks, account, tutoring] = await Promise.all([
    getSchool(),
    db.select().from(schema.gymDays),
    db
      .select()
      .from(schema.planBlocks)
      .where(and(gte(schema.planBlocks.date, weekStart), lte(schema.planBlocks.date, last)))
      .orderBy(asc(schema.planBlocks.start)),
    getGoogleAccount(),
    db.select().from(schema.tutoring),
  ]);
  // Events the hub writes to the Personal Hub calendar (shown as school / gym / tutoring / plans instead).
  const mirrored = new Set((await db.select({ id: schema.calendarLinks.eventId }).from(schema.calendarLinks)).map((r) => r.id));

  let events: CalendarEvent[] = [];
  let calendarError: string | null = null;
  const googleConnected = Boolean(account?.accessToken);
  if (googleConnected) {
    try {
      const from = new TZDate(`${weekStart}T00:00:00`, tz);
      const to = new TZDate(`${addDays(last, 1)}T00:00:00`, tz);
      events = await listEvents(from, to, settings.calendarIds);
    } catch (err) {
      calendarError = err instanceof Error ? err.message : "Could not load Google Calendar";
    }
  }

  const views: DayView[] = dates.map((date) => {
    const weekday = weekdayOf(date);
    const sd = schoolDays.find((d) => d.weekday === weekday);
    const subjects = classes.filter((c) => c.weekday === weekday);
    const periods = sd ? schoolPeriods(sd.startTime, subjects.length, settings.classMinutes, settings.breakMinutes) : [];
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
    const gymDay = gym.find((g) => g.weekday === weekday) ?? null;
    let gymFixed: Interval | null = null;
    if (gymDay?.timing === "after_school" && periods.length) {
      const start = periods[periods.length - 1].end + (travelTime(settings.travel, "school", "gym") ?? 0);
      gymFixed = { start, end: start + gymDay.durationMin };
    } else if (gymDay?.timing === "fixed" && gymDay.startTime) {
      const start = toMin(gymDay.startTime);
      gymFixed = { start, end: start + gymDay.durationMin };
    }
    const dayTutoring = tutoring.filter((t) => occursOn(t, date)).sort((a, b) => a.start.localeCompare(b.start));
    const fixed: PlacedItem[] = [
      ...(periods.length ? [{ start: periods[0].start, end: periods[periods.length - 1].end, place: "school", title: "School" }] : []),
      ...(gymFixed && gymDay ? [{ ...gymFixed, place: "gym", title: `Gym (${gymDay.title})` }] : []),
      ...timed.filter((e) => e.place).map((e) => ({ start: e.startMin, end: e.endMin, place: e.place!, title: e.title })),
      ...dayTutoring.map((t) => ({ start: toMin(t.start), end: toMin(t.end), place: t.place, title: `${t.subject} tutoring` })),
      ...blocks
        .filter((b) => b.date === date && b.status === "accepted")
        .map((b) => ({ start: toMin(b.start), end: toMin(b.end), place: placeOf(b.kind), title: b.title })),
    ];
    return {
      date,
      weekday,
      school: periods.map((p, i) => ({ ...p, subject: subjects[i].subject })),
      gym: gymDay,
      gymFixed,
      events: timed.sort((a, b) => a.startMin - b.startMin),
      allDay,
      blocks: blocks.filter((b) => b.date === date),
      tutoring: dayTutoring,
      clashes: fixedClashes(fixed, settings.travel, placeLabel),
    };
  });

  return { days: views, settings, calendarError, googleConnected };
}

/** What the planner must work around: school, calendar events and accepted blocks. */
export function toPlannerDays(days: DayView[], study: Map<string, DayContext["study"]>): DayContext[] {
  return days.map((d) => {
    const schoolEnd = d.school.length ? d.school[d.school.length - 1].end : null;
    const busy: DayContext["busy"] = [];
    if (d.school.length) {
      busy.push({ start: d.school[0].start, end: schoolEnd!, title: "School", kind: "school", place: "school" });
    }
    for (const e of d.events) busy.push({ start: e.startMin, end: e.endMin, title: e.title, kind: "calendar", place: e.place ?? "any" });
    if (d.gymFixed && d.gym) busy.push({ ...d.gymFixed, title: `Gym · ${d.gym.title}`, kind: "gym", place: "gym" });
    for (const t of d.tutoring) busy.push({ start: toMin(t.start), end: toMin(t.end), title: `Tutoring · ${t.subject}`, kind: "tutoring", place: t.place });
    for (const b of d.blocks) {
      if (b.status === "accepted") busy.push({ start: toMin(b.start), end: toMin(b.end), title: b.title, kind: b.kind, place: placeOf(b.kind) });
    }
    return {
      date: d.date,
      weekday: d.weekday,
      busy,
      schoolEnd,
      study: study.get(d.date) ?? null,
      // Fixed gym is already busy time; only flexible gym days need a suggested slot.
      gym: d.gym && !d.gymFixed ? { title: d.gym.title, durationMin: d.gym.durationMin } : null,
    };
  });
}

/** All suggestions not yet accepted, across every week (what "Clear suggestions" removes). */
export async function countSuggestions() {
  const db = await getDb();
  const rows = await db.select({ id: schema.planBlocks.id }).from(schema.planBlocks).where(eq(schema.planBlocks.status, "proposed"));
  return rows.length;
}

export const placeLabel = (p: string) => (p === "online" ? "online" : p === "any" ? "an event" : p);
