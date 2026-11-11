/**
 * Pure mapping between the app's items and Google Calendar events (no I/O, unit-tested).
 *
 * Each synced item has a stable key:
 *   block:<id>                one accepted plan block
 *   task:<id>                 all-day reminder on the due date
 */
import { GOOGLE_NAME, LEGACY_APP_NAME } from "../brand.ts";
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
  blocks: { id: number; date: string; start: string; end: string; title: string; reason: string; status: string }[];
  tasks: { id: number; title: string; notes: string; due: string | null; done: boolean }[];
};

export const MARK = `Synced from ${GOOGLE_NAME}.`; // the Google-side name, so events synced before the rename still match
/** True for events this app wrote, including ones written under its old name. */
export const hasMark = (description: string | null | undefined) =>
  !!description && (description.includes(MARK) || description.includes(`Synced from ${LEGACY_APP_NAME}.`));
const dt = (date: string, hm: string, tz: string): EventTime => ({ dateTime: `${date}T${hm}:00`, timeZone: tz });

export function buildDesired(h: HubData): DesiredEvent[] {
  const out: DesiredEvent[] = [];
  const tz = h.timezone;

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
  | { kind: "block"; id: number; date: string; start: string; end: string; title: string }
  | { kind: "task"; id: number; due: string; title: string };

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
    case "block":
      if (!s.hm || !en.hm) return null;
      return { kind: "block", id: Number(a), date: s.date, start: s.hm, end: en.hm, title: summary || "Plan block" };
    case "task":
      return { kind: "task", id: Number(a), due: s.date, title: summary.replace(/^Due:\s*/i, "") || "Task" };
    default:
      return null;
  }
}
