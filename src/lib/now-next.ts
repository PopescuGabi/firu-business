import "server-only";
import { placeOf } from "./planner";
import { toMin } from "./time";
import { travelTime, type TravelTable } from "./travel";
import type { DayView } from "./week";

export type NowItem = { start: number; end: number; title: string; kind: string; place: string };

/** Everything fixed or accepted today, one item per class/session (suggestions left out). */
export function dayItems(day: DayView): NowItem[] {
  const items: NowItem[] = [
    ...day.school.map((c) => ({ start: c.start, end: c.end, title: c.subject, kind: "school", place: "school" })),
    ...(day.gymFixed && day.gym ? [{ ...day.gymFixed, title: `Gym · ${day.gym.title}`, kind: "gym", place: "gym" }] : []),
    ...day.tutoring.map((t) => ({ start: toMin(t.start), end: toMin(t.end), title: `Tutoring · ${t.subject}`, kind: "tutoring", place: t.place })),
    ...day.events.map((e) => ({ start: e.startMin, end: e.endMin, title: e.title, kind: "calendar", place: "any" })),
    ...day.blocks
      .filter((b) => b.status === "accepted")
      .map((b) => ({ start: toMin(b.start), end: toMin(b.end), title: b.title, kind: b.kind, place: placeOf(b.kind) })),
  ];
  return items.sort((a, b) => a.start - b.start);
}

/** What's on now, what's next, and when to leave for it. */
export function nowAndNext(day: DayView, now: number, travel: TravelTable) {
  const items = dayItems(day);
  const current = items.find((i) => i.start <= now && now < i.end) ?? null;
  const next = items.find((i) => i.start > now) ?? null;
  let leaveBy: number | null = null;
  if (next) {
    // Where you'll be before the next item: the last real place before it, or home.
    const before = items.filter((i) => i.end <= next.start && i.place !== "any" && i.place !== "online").pop();
    const from = before?.place ?? "home";
    const minutes = travelTime(travel, from, next.place);
    if (minutes && minutes > 0) leaveBy = next.start - minutes;
  }
  return { current, next, leaveBy };
}
