import { toHHMM, toMin, WEEKDAYS, type Interval } from "./time.ts";
import { fitsDay, type PlacedItem, type TravelTable } from "./travel.ts";

export type DayContext = {
  date: string;
  weekday: number;
  // Fixed commitments, each with where it happens (for travel time).
  busy: (Interval & { title: string; kind: string; place: string })[];
  schoolEnd: number | null;
  // Study only goes to tutoring subjects: prep for the next session.
  study: { subject: string; sessionDate: string; sessionWeekday: number } | null;
  gym: { title: string; durationMin: number } | null;
};

export type PlanTask = { id: number; title: string; due: string | null; estimateMin: number; priority: number };

export type ProposedBlock = {
  date: string;
  start: string;
  end: string;
  title: string;
  kind: "gym" | "study" | "project" | "task" | "break";
  taskId: number | null;
  reason: string;
};

export type PlanOptions = { dayStart: string; dayEnd: string; freeDayStart: string; travel: TravelTable };

/** When the day starts at home: the later start on days without school (travel included). */
const homeStart = (day: DayContext, opts: PlanOptions) =>
  day.schoolEnd == null ? Math.max(toMin(opts.dayStart), toMin(opts.freeDayStart)) : toMin(opts.dayStart);

/** Earliest a planned block may start: after school, or the later start on days without school. */
export const earliestStart = (day: DayContext, opts: PlanOptions) =>
  day.schoolEnd ?? Math.max(toMin(opts.dayStart), toMin(opts.freeDayStart));

/** Where a planned block happens: gym at the gym, everything else at home. */
// Posting (from Marketing) can happen anywhere, like a break.
export const placeOf = (kind: string) => (kind === "gym" ? "gym" : kind === "break" || kind === "post" ? "any" : "home");

const fixedItems = (day: DayContext): PlacedItem[] => day.busy.map((b) => ({ ...b }));
const toItem = (b: ProposedBlock): PlacedItem => ({
  start: toMin(b.start),
  end: toMin(b.end),
  place: placeOf(b.kind),
  title: b.title,
  planned: true,
});

/**
 * Basic planner used when Claude isn't configured: gym first on gym days,
 * a study block for the next tutoring session, then tasks by due date and priority.
 * Every block leaves the travel time between places.
 */
export function basicPlan(days: DayContext[], tasks: PlanTask[], opts: PlanOptions) {
  const blocks: ProposedBlock[] = [];
  const queue = [...tasks].sort(
    (a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.priority - a.priority,
  );
  const remaining = new Map(queue.map((t) => [t.id, t.estimateMin]));
  const dayEnd = toMin(opts.dayEnd);

  for (const day of days) {
    const items = fixedItems(day);
    const earliest = earliestStart(day, opts);

    const place = (length: number, b: Omit<ProposedBlock, "date" | "start" | "end">) => {
      for (let start = Math.ceil(earliest / 5) * 5; start + length <= dayEnd; start += 5) {
        const block: ProposedBlock = { ...b, date: day.date, start: toHHMM(start), end: toHHMM(start + length) };
        const candidate = toItem(block);
        if (fitsDay([...items, candidate], opts.travel, homeStart(day, opts), dayEnd)) {
          items.push(candidate);
          blocks.push(block);
          return true;
        }
      }
      return false;
    };

    if (day.gym) {
      place(day.gym.durationMin, { title: `Gym · ${day.gym.title}`, kind: "gym", taskId: null, reason: "Gym day in your split." });
    }
    if (day.study) {
      place(60, {
        title: `Study · ${day.study.subject}`,
        kind: "study",
        taskId: null,
        reason: `Prep for ${day.study.subject} tutoring on ${WEEKDAYS[day.study.sessionWeekday - 1]}.`,
      });
    }
    for (const t of queue) {
      const left = remaining.get(t.id) ?? 0;
      if (left <= 0) continue;
      const chunk = Math.min(left, 90);
      if (place(chunk, { title: t.title, kind: "task", taskId: t.id, reason: t.due ? `Due ${t.due}.` : "Open task." })) {
        remaining.set(t.id, left - chunk);
      }
    }
  }
  return blocks;
}

/** Keeps only blocks that are well-formed and leave enough travel time; the rest are dropped. */
export function validateBlocks(blocks: ProposedBlock[], days: DayContext[], opts: PlanOptions) {
  const byDate = new Map(days.map((d) => [d.date, { day: d, items: fixedItems(d) }]));
  const kept: ProposedBlock[] = [];
  const sorted = [...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  for (const b of sorted) {
    const entry = byDate.get(b.date);
    if (!entry || !/^\d{2}:\d{2}$/.test(b.start) || !/^\d{2}:\d{2}$/.test(b.end)) continue;
    const item = toItem(b);
    if (item.end <= item.start || item.start < earliestStart(entry.day, opts)) continue;
    if (entry.items.some((x) => x.start < item.end && item.start < x.end)) continue;
    if (!fitsDay([...entry.items, item], opts.travel, homeStart(entry.day, opts), toMin(opts.dayEnd))) continue;
    entry.items.push(item);
    kept.push(b);
  }
  return kept;
}
