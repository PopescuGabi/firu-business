import { addDays, weekdayOf } from "./time.ts";

export type TutoringSession = {
  id: number;
  subject: string;
  weekday: number;
  start: string;
  end: string;
  everyWeeks: number;
  startDate: string;
};

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T12:00:00Z`) / 86_400_000);

/** Does this session take place on this date? */
export function occursOn(s: Pick<TutoringSession, "weekday" | "everyWeeks" | "startDate">, date: string) {
  if (date < s.startDate || weekdayOf(date) !== s.weekday) return false;
  const weeks = (dayNumber(date) - dayNumber(s.startDate)) / 7;
  return weeks % Math.max(1, s.everyWeeks) === 0;
}

/** First date on or after `from` that falls on `weekday`. */
export function nextWeekday(weekday: number, from: string) {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7);
}

/** The next session strictly after `date` (within 8 weeks), for planning study before it. */
export function nextSessionAfter(sessions: TutoringSession[], date: string) {
  for (let i = 1; i <= 56; i++) {
    const d = addDays(date, i);
    const s = sessions.filter((x) => occursOn(x, d)).sort((a, b) => a.start.localeCompare(b.start))[0];
    if (s) return { session: s, date: d };
  }
  return null;
}
