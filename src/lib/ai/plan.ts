import "server-only";
import { z } from "zod";
import type { DayContext, PlanTask } from "../planner";
import { freeSlots, toHHMM, toMin, WEEKDAYS } from "../time";

export const planOutput = z.object({
  advice: z.string(),
  dailyTargets: z.array(
    z.object({ date: z.string(), projectMin: z.number(), note: z.string() }),
  ),
  blocks: z.array(
    z.object({
      date: z.string(),
      start: z.string(),
      end: z.string(),
      title: z.string(),
      kind: z.enum(["project", "task", "break"]),
      taskId: z.number().int().nullable(),
      reason: z.string(),
    }),
  ),
});
export type PlanOutput = z.infer<typeof planOutput>;

export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["advice", "dailyTargets", "blocks"],
  properties: {
    advice: { type: "string" },
    dailyTargets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "projectMin", "note"],
        properties: {
          date: { type: "string" },
          projectMin: { type: "integer" },
          note: { type: "string" },
        },
      },
    },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "start", "end", "title", "kind", "taskId", "reason"],
        properties: {
          date: { type: "string", description: "yyyy-mm-dd" },
          start: { type: "string", description: "HH:mm, 24h local time" },
          end: { type: "string", description: "HH:mm, 24h local time" },
          title: { type: "string" },
          kind: { type: "string", enum: ["project", "task", "break"] },
          taskId: { anyOf: [{ type: "integer" }, { type: "null" }] },
          reason: { type: "string", description: "One short sentence: why this slot." },
        },
      },
    },
  },
} as const;

/** The planner's instructions, written for the sections this person uses (lib/modules.ts). */
export function planSystem(modules: readonly string[]) {
  const clients = modules.includes("clients");
  return `You plan the work week for someone${clients ? " who does marketing and content work for clients" : ""}.

Fixed commitments (Google Calendar events and already-accepted blocks) can't move. Fill only the free slots you are given.

Goals, in order:
1. ${clients ? "Client work and open tasks" : "Open tasks"}: earliest due date and highest priority first; split long tasks into blocks of at most 90 minutes.
2. Keep the evening lighter, leave short breaks between blocks, and never plan anything in the past.

Travel time is required. Every item has a place (home, a client's place, or online = wherever they already are). Work and task blocks happen at home. Between two items in different places, the gap must be at least the travel time listed. The day starts and ends at home. Blocks that don't leave enough travel time are thrown away, so leave a few minutes extra.

Also recommend how many minutes per day to spend on project work, with a short note. Keep "advice" to 2–4 practical sentences.`;
}

export function buildPlanPrompt(opts: {
  now: { date: string; time: string };
  days: DayContext[];
  tasks: (PlanTask & { client: string | null })[];
  travel: Record<string, number>;
  dayStart: string;
  dayEnd: string;
}) {
  const lines: string[] = [`Now: ${opts.now.date} ${opts.now.time}. Day window: ${opts.dayStart}–${opts.dayEnd}.`, ""];
  for (const d of opts.days) {
    const dayFrom = toMin(opts.dayStart);
    const start = d.date === opts.now.date ? Math.max(dayFrom, toMin(opts.now.time)) : dayFrom;
    const free = freeSlots(start, toMin(opts.dayEnd), d.busy, 30);
    lines.push(`## ${WEEKDAYS[d.weekday - 1]} ${d.date}`);
    lines.push(
      `Busy: ${d.busy.length ? d.busy.map((b) => `${toHHMM(b.start)}–${toHHMM(b.end)} ${b.title} @${b.place}`).join("; ") : "nothing"}`,
    );
    lines.push(`Gaps (before travel time): ${free.map((f) => `${toHHMM(f.start)}–${toHHMM(f.end)}`).join(", ") || "none"}`);
    lines.push("");
  }
  lines.push("## Travel times (minutes, from > to; same place = 0; online needs none)");
  for (const [k, v] of Object.entries(opts.travel)) lines.push(`- ${k.replace(">", " → ")}: ${v}`);
  lines.push("");
  lines.push("## Open tasks");
  if (!opts.tasks.length) lines.push("None.");
  for (const t of opts.tasks) {
    lines.push(
      `- id ${t.id}: ${t.title}${t.client ? ` [${t.client}]` : ""}, ~${t.estimateMin} min, priority ${["low", "normal", "high"][t.priority]}${t.due ? `, due ${t.due}` : ""}`,
    );
  }
  return lines.join("\n");
}
