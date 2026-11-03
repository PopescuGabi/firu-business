// Pure helpers (no server imports) so they can be unit-tested and used on the client.
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** For showing a time: midnight at the end of a day (24:00) reads 00:00. */
export const clock = (min: number) => toHHMM(min % (24 * 60));

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** yyyy-mm-dd → 1 (Mon) … 7 (Sun) */
export function weekdayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string) {
  return addDays(date, 1 - weekdayOf(date));
}

export type Interval = { start: number; end: number };

export function schoolPeriods(startTime: string, count: number, classMin: number, breakMin: number) {
  const first = toMin(startTime);
  return Array.from({ length: count }, (_, i) => {
    const start = first + i * (classMin + breakMin);
    return { start, end: start + classMin };
  });
}

/** Free intervals inside [dayStart, dayEnd] that don't overlap any busy interval. */
export function freeSlots(dayStart: number, dayEnd: number, busy: Interval[], minLength = 15): Interval[] {
  const sorted = busy
    .map((b) => ({ start: Math.max(b.start, dayStart), end: Math.min(b.end, dayEnd) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  let cursor = dayStart;
  for (const b of sorted) {
    if (b.start > cursor) out.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd > cursor) out.push({ start: cursor, end: dayEnd });
  return out.filter((s) => s.end - s.start >= minLength);
}

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/** A yyyy-mm-dd date in words (en-GB), e.g. fmtDate(d, { day: "numeric", month: "short" }) → "3 Nov". */
export const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
