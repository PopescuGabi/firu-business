import { z } from "zod";
import type { Exercise } from "./db/schema.ts";

/** Exercises: one per line, "Name × sets" or "Name × sets × reps" (also "Name 3x8", "Name x 3"). */
export function parseExercises(text: string): Exercise[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((line) => {
      const m = line.match(/^(.*?)[\s×x*-]*(\d{1,2})(?:\s*[×x*]\s*(\d{1,3}))?\s*(?:sets?)?$/i);
      if (!m || !m[1].trim()) return { name: line, sets: 3 };
      const reps = m[3] ? Math.min(100, Math.max(1, Number(m[3]))) : undefined;
      return { name: m[1].trim(), sets: Math.max(1, Number(m[2])), ...(reps ? { reps } : {}) };
    });
}

export const formatExercises = (list: Exercise[]) => list.map((e) => `${e.name} × ${e.sets}${e.reps ? ` × ${e.reps}` : ""}`).join("\n");

// ── Progression (log every set; when all sets reach the target reps, add a little) ──

/** Weight added once every set reaches the target reps. */
export const STEP_KG = 2.5;
/** Target reps when an exercise doesn't set its own. */
export const DEFAULT_REPS = 10;

export type SetLog = { date: string; setNo: number; weight: number; reps: number };
export type Target = {
  weight: number; // kg for every set next time (0 = bodyweight or not known yet)
  reps: number;
  change: "start" | "kg" | "rep";
  last: { date: string; sets: { weight: number; reps: number }[] } | null;
};

/** The last session for one exercise (the latest date in `history`), sets in order. */
export function lastSession(history: SetLog[]) {
  if (!history.length) return null;
  const date = history.reduce((d, h) => (h.date > d ? h.date : d), history[0].date);
  const sets = history
    .filter((h) => h.date === date)
    .sort((a, b) => a.setNo - b.setNo)
    .map(({ weight, reps }) => ({ weight, reps }));
  return { date, sets };
}

/**
 * Next time's target from the last session: every planned set at the target reps (at the working weight) →
 * +2.5 kg; otherwise the same weight and one more rep. Bodyweight work (0 kg) progresses by reps only.
 */
export function nextTarget(ex: Exercise, history: SetLog[]): Target {
  const goal = ex.reps ?? DEFAULT_REPS;
  const last = lastSession(history);
  if (!last || !last.sets.length) return { weight: 0, reps: goal, change: "start", last: null };
  const top = Math.max(...last.sets.map((s) => s.weight));
  const working = last.sets.filter((s) => s.weight === top);
  const allDone = last.sets.length >= ex.sets && working.length >= ex.sets && working.every((s) => s.reps >= goal);
  if (allDone && top > 0) return { weight: round(top + STEP_KG), reps: goal, change: "kg", last };
  const fewest = Math.min(...working.map((s) => s.reps));
  return { weight: top, reps: allDone ? fewest + 1 : Math.min(goal, fewest + 1), change: "rep", last };
}

const round = (kg: number) => Math.round(kg * 4) / 4;

/** One point per session: the heaviest set and the reps done with it, oldest first. */
export function progressSeries(history: SetLog[]) {
  const byDate = new Map<string, { top: number; reps: number; volume: number }>();
  for (const h of history) {
    const p = byDate.get(h.date) ?? { top: 0, reps: 0, volume: 0 };
    if (h.weight > p.top || (h.weight === p.top && h.reps > p.reps)) Object.assign(p, { top: h.weight, reps: h.reps });
    p.volume += h.weight * h.reps;
    byDate.set(h.date, p);
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, p]) => ({ date, ...p }));
}

/** "62.5 kg × 10", or "12 reps" for bodyweight. */
export const fmtSet = (s: { weight: number; reps: number }) => (s.weight > 0 ? `${s.weight} kg × ${s.reps}` : `${s.reps} reps`);

// ── Gym coach (Claude proposes a new split; the person applies it with one tap) ──

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);

export const gymDayProposal = z
  .object({
    weekday: z.number().int().min(1).max(7),
    title: z.string().trim().min(1).max(100),
    durationMin: z.number().int().min(15).max(240),
    timing: z.enum(["flexible", "after_school", "fixed"]),
    startTime: hhmm.nullish(),
    exercises: z
      .array(z.object({ name: z.string().trim().min(1).max(100), sets: z.number().int().min(1).max(10), reps: z.number().int().min(1).max(50).optional() }))
      .min(1)
      .max(15),
  })
  .refine((d) => d.timing !== "fixed" || d.startTime, { message: "A fixed day needs a start time" });

export const gymProposal = z
  .object({
    summary: z.string().max(1000),
    days: z.array(gymDayProposal).max(7).default([]),
    remove: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  })
  .refine((p) => new Set(p.days.map((d) => d.weekday)).size === p.days.length, { message: "A day appears twice" })
  .refine((p) => !p.remove.some((w) => p.days.some((d) => d.weekday === w)), { message: "A day is both changed and removed" })
  .refine((p) => p.days.length + p.remove.length > 0, { message: "Nothing to change" });
export type GymProposal = z.infer<typeof gymProposal>;
export type GymDayProposal = z.infer<typeof gymDayProposal>;

/** Claude's tool for proposing split changes (not strict, so the limits stay in the schema). */
export const gymTool = {
  name: "propose_split",
  description:
    "Propose changes to the gym split. Include only the days that change (each with its full new workout) and the weekdays to drop. The person reviews and applies them with one tap.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      summary: { type: "string", description: "One or two sentences: what changes and why." },
      days: {
        type: "array",
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            weekday: { type: "integer", minimum: 1, maximum: 7, description: "1 = Monday … 7 = Sunday" },
            title: { type: "string", description: "e.g. Push, Legs, Upper A" },
            durationMin: { type: "integer", minimum: 15, maximum: 240 },
            timing: { type: "string", enum: ["flexible", "after_school", "fixed"] },
            startTime: { type: "string", description: "HH:mm, only when timing is fixed" },
            exercises: {
              type: "array",
              minItems: 1,
              maxItems: 15,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  sets: { type: "integer", minimum: 1, maximum: 10 },
                  reps: { type: "integer", minimum: 1, maximum: 50, description: "Target reps per set; weight goes up once every set reaches it" },
                },
                required: ["name", "sets"],
              },
            },
          },
          required: ["weekday", "title", "durationMin", "timing", "exercises"],
        },
      },
      remove: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 }, description: "Weekdays to stop training on" },
    },
    required: ["summary", "days", "remove"],
  },
};

export type GymDayNow = { weekday: number; title: string; durationMin: number; timing: string; startTime: string | null; exercises: Exercise[] };
export type DayChange =
  | { kind: "new"; weekday: number; day: GymDayProposal }
  | { kind: "changed"; weekday: number; day: GymDayProposal; before: GymDayNow; added: string[]; dropped: string[] }
  | { kind: "same"; weekday: number; day: GymDayProposal }
  | { kind: "removed"; weekday: number; before: GymDayNow };

/** What a proposal changes compared with the current split, Monday first. */
export function diffSplit(current: GymDayNow[], p: Pick<GymProposal, "days" | "remove">): DayChange[] {
  const out: DayChange[] = [];
  const names = (l: { name: string }[]) => l.map((e) => e.name.toLowerCase());
  for (const day of p.days) {
    const before = current.find((c) => c.weekday === day.weekday);
    if (!before) {
      out.push({ kind: "new", weekday: day.weekday, day });
      continue;
    }
    const added = day.exercises.filter((e) => !names(before.exercises).includes(e.name.toLowerCase())).map((e) => e.name);
    const dropped = before.exercises.filter((e) => !names(day.exercises).includes(e.name.toLowerCase())).map((e) => e.name);
    const same =
      before.title === day.title &&
      before.durationMin === day.durationMin &&
      before.timing === day.timing &&
      (before.startTime ?? null) === (day.timing === "fixed" ? (day.startTime ?? null) : null) &&
      formatExercises(before.exercises) === formatExercises(day.exercises);
    out.push(same ? { kind: "same", weekday: day.weekday, day } : { kind: "changed", weekday: day.weekday, day, before, added, dropped });
  }
  for (const w of p.remove) {
    const before = current.find((c) => c.weekday === w);
    if (before) out.push({ kind: "removed", weekday: w, before });
  }
  return out.sort((a, b) => a.weekday - b.weekday);
}
