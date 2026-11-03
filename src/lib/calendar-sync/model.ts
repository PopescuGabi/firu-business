/**
 * Pure mapping between Personal Hub items and Google Calendar events (no I/O, unit-tested).
 *
 * Each synced item has a stable key:
 *   class:<weekday>:<period>  weekly, until the last school day
 *   gym:<weekday>             weekly (fixed-time gym days only)
 *   tutoring:<id>             weekly or every N weeks
 *   block:<id>                one accepted plan block
 *   task:<id>                 all-day reminder on the due date
 */
import { addDays, toHHMM, weekdayOf } from "../time.ts";

export type EventTime = { date?: string; dateTime?: string; timeZone?: string };

export type DesiredEvent = {
  key: string;
  summary: string;
  description: string;
  location?: string;
  start: EventTime;
  end: EventTime;
  recurrence?: string[];
};

/** What a change is compared on: everything except the anchor date of a repeating series. */
export type Signature = {
  summary: string;
  description: string;
  location: string;
  allDay: boolean;
  day: string; // weekday number for repeating events, date for one-off ones
  start: string; // HH:mm, or date for all-day
  end: string;
  rule: string; // RRULE without UNTIL anchor details normalised
};

export type HubData = {
  timezone: string;
  today: string; // yyyy-mm-dd
  schoolYearEnd: string | null; // last school day, yyyy-mm-dd
  classMinutes: number;
  breakMinutes: number;
  schoolGymTravel: number; // minutes from school to gym
  schoolDays: { weekday: number; startTime: string }[];
  classes: { weekday: number; period: number; subject: string }[];
  gym: { weekday: number; title: string; durationMin: number; timing: string; startTime: string | null; exercises: { name: string; sets: number }[] }[];
  tutoring: { id: number; subject: string; weekday: number; start: string; end: string; everyWeeks: number; startDate: string; place: string }[];
  blocks: { id: number; date: string; start: string; end: string; title: string; reason: string; status: string }[];
  tasks: { id: number; title: string; notes: string; due: string | null; done: boolean }[];
};

export const MARK = "Synced from Personal Hub.";
const dt = (date: string, hm: string, tz: string): EventTime => ({ dateTime: `${date}T${hm}:00`, timeZone: tz });
const untilRule = (lastDay: string | null) => (lastDay ? `;UNTIL=${lastDay.replace(/-/g, "")}T235959Z` : "");
/** This week's occurrence of a weekday (a stable-enough anchor; signatures ignore the date). */
const weekAnchor = (today: string, weekday: number) => addDays(today, weekday - weekdayOf(today));

export function buildDesired(h: HubData): DesiredEvent[] {
  const out: DesiredEvent[] = [];
  const tz = h.timezone;

  // School classes.
  for (const day of h.schoolDays) {
    const subjects = h.classes.filter((c) => c.weekday === day.weekday).sort((a, b) => a.period - b.period);
    const [sh, sm] = day.startTime.split(":").map(Number);
    subjects.forEach((c, i) => {
      const start = sh * 60 + sm + i * (h.classMinutes + h.breakMinutes);
      const date = weekAnchor(h.today, day.weekday);
      out.push({
        key: `class:${day.weekday}:${c.period}`,
        summary: c.subject,
        description: `School class. ${MARK}`,
        start: dt(date, toHHMM(start), tz),
        end: dt(date, toHHMM(start + h.classMinutes), tz),
        recurrence: [`RRULE:FREQ=WEEKLY${untilRule(h.schoolYearEnd)}`],
      });
    });
  }

  // Fixed-time gym days (flexible days appear once a plan block is accepted).
  for (const g of h.gym) {
    let start: number | null = null;
    if (g.timing === "fixed" && g.startTime) {
      const [hh, mm] = g.startTime.split(":").map(Number);
      start = hh * 60 + mm;
    } else if (g.timing === "after_school") {
      const day = h.schoolDays.find((d) => d.weekday === g.weekday);
      const count = h.classes.filter((c) => c.weekday === g.weekday).length;
      if (day && count) {
        const [hh, mm] = day.startTime.split(":").map(Number);
        start = hh * 60 + mm + (count - 1) * (h.classMinutes + h.breakMinutes) + h.classMinutes + h.schoolGymTravel;
      }
    }
    if (start == null) continue;
    const date = weekAnchor(h.today, g.weekday);
    out.push({
      key: `gym:${g.weekday}`,
      summary: `Gym · ${g.title}`,
      description: `${g.exercises.map((e) => `${e.name} × ${e.sets}`).join("\n")}\n\n${MARK}`.trim(),
      start: dt(date, toHHMM(start), tz),
      end: dt(date, toHHMM(start + g.durationMin), tz),
      recurrence: ["RRULE:FREQ=WEEKLY"],
    });
  }

  // Tutoring.
  for (const t of h.tutoring) {
    out.push({
      key: `tutoring:${t.id}`,
      summary: `Tutoring · ${t.subject}`,
      description: `Tutoring. ${MARK}`,
      location: t.place === "online" ? "Online" : t.place,
      start: dt(t.startDate, t.start, tz),
      end: dt(t.startDate, t.end, tz),
      recurrence: [`RRULE:FREQ=WEEKLY${t.everyWeeks > 1 ? `;INTERVAL=${t.everyWeeks}` : ""}`],
    });
  }

  // Accepted plan blocks.
  for (const b of h.blocks.filter((b) => b.status === "accepted")) {
    out.push({
      key: `block:${b.id}`,
      summary: b.title,
      description: `${b.reason ? `${b.reason}\n\n` : ""}${MARK}`,
      start: dt(b.date, b.start, tz),
      end: dt(b.date, b.end, tz),
    });
  }

  // Task due dates (open tasks only).
  for (const t of h.tasks.filter((t) => t.due && !t.done)) {
    out.push({
      key: `task:${t.id}`,
      summary: `Due: ${t.title}`,
      description: `${t.notes ? `${t.notes}\n\n` : ""}${MARK}`,
      start: { date: t.due! },
      end: { date: addDays(t.due!, 1) },
    });
  }
  return out;
}

/** Splits a Google/desired dateTime into local date and HH:mm (inputs carry the calendar's local time). */
export function localParts(t: EventTime, toLocal: (iso: string) => { date: string; hm: string }) {
  if (t.date) return { date: t.date, hm: "" };
  return toLocal(t.dateTime!);
}

const normRule = (rec?: string[]) =>
  (rec ?? [])
    .filter((r) => r.startsWith("RRULE:"))
    .map((r) =>
      r
        .replace(/^RRULE:/, "")
        .split(";")
        .filter((p) => !p.startsWith("WKST=") && !p.startsWith("BYDAY="))
        .sort()
        .join(";"),
    )
    .join("|");

export function signature(
  e: { summary?: string; description?: string; location?: string; start: EventTime; end: EventTime; recurrence?: string[] },
  toLocal: (iso: string) => { date: string; hm: string },
): Signature {
  const s = localParts(e.start, toLocal);
  const en = localParts(e.end, toLocal);
  const allDay = Boolean(e.start.date);
  // Weekly series compare on the weekday; every-N-weeks series also need the anchor date (it picks the weeks).
  const weekly = Boolean(e.recurrence?.length) && intervalOf(e.recurrence) === 1;
  return {
    summary: e.summary ?? "",
    description: e.description ?? "",
    location: e.location ?? "",
    allDay,
    day: weekly ? String(weekdayOf(s.date)) : s.date,
    start: allDay ? s.date : s.hm,
    end: allDay ? en.date : en.hm,
    rule: normRule(e.recurrence),
  };
}

export const sameSignature = (a: Signature, b: Signature) => JSON.stringify(a) === JSON.stringify(b);

/** Interval (every N weeks) from a recurrence rule. */
export function intervalOf(rec?: string[]) {
  const m = (rec ?? []).join(";").match(/INTERVAL=(\d+)/);
  return m ? Number(m[1]) : 1;
}

/** Turns a remote edit into a change for the hub item behind `key` (null = nothing the hub can represent). */
export type HubChange =
  | { kind: "class"; weekday: number; period: number; subject: string }
  | { kind: "gym"; weekday: number; newWeekday: number; title: string; startTime: string; durationMin: number }
  | { kind: "tutoring"; id: number; subject: string; weekday: number; start: string; end: string; everyWeeks: number; startDate: string }
  | { kind: "block"; id: number; date: string; start: string; end: string; title: string }
  | { kind: "task"; id: number; due: string; title: string };

const minutesBetween = (a: string, b: string) => {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
};

export function changeFromRemote(
  key: string,
  e: { summary?: string; start: EventTime; end: EventTime; recurrence?: string[] },
  toLocal: (iso: string) => { date: string; hm: string },
): HubChange | null {
  const [kind, a, b] = key.split(":");
  const s = localParts(e.start, toLocal);
  const en = localParts(e.end, toLocal);
  const summary = (e.summary ?? "").trim();
  switch (kind) {
    case "class":
      // Only renames map onto the timetable; class times follow the school day's start.
      return summary ? { kind: "class", weekday: Number(a), period: Number(b), subject: summary } : null;
    case "gym":
      if (!s.hm || !en.hm) return null;
      return {
        kind: "gym",
        weekday: Number(a),
        newWeekday: weekdayOf(s.date),
        title: summary.replace(/^Gym\s*·\s*/i, "") || "Gym",
        startTime: s.hm,
        durationMin: Math.max(15, minutesBetween(s.hm, en.hm)),
      };
    case "tutoring":
      if (!s.hm || !en.hm) return null;
      return {
        kind: "tutoring",
        id: Number(a),
        subject: summary.replace(/^Tutoring\s*·\s*/i, "") || "Tutoring",
        weekday: weekdayOf(s.date),
        start: s.hm,
        end: en.hm,
        everyWeeks: intervalOf(e.recurrence),
        startDate: s.date,
      };
    case "block":
      if (!s.hm || !en.hm) return null;
      return { kind: "block", id: Number(a), date: s.date, start: s.hm, end: en.hm, title: summary || "Plan block" };
    case "task":
      return { kind: "task", id: Number(a), due: s.date, title: summary.replace(/^Due:\s*/i, "") || "Task" };
    default:
      return null;
  }
}
