import "server-only";
import { z } from "zod";
import type { DayContext, PlanTask } from "../planner";
import { freeSlots, toHHMM, toMin, WEEKDAYS } from "../time";

export const planOutput = z.object({
  advice: z.string(),
  dailyTargets: z.array(
    z.object({ date: z.string(), studyMin: z.number(), projectMin: z.number(), gymMin: z.number(), note: z.string() }),
  ),
  blocks: z.array(
    z.object({
      date: z.string(),
      start: z.string(),
      end: z.string(),
      title: z.string(),
      kind: z.enum(["gym", "study", "project", "task", "break"]),
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
        required: ["date", "studyMin", "projectMin", "gymMin", "note"],
        properties: {
          date: { type: "string" },
          studyMin: { type: "integer" },
          projectMin: { type: "integer" },
          gymMin: { type: "integer" },
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
          kind: { type: "string", enum: ["gym", "study", "project", "task", "break"] },
          taskId: { anyOf: [{ type: "integer" }, { type: "null" }] },
          reason: { type: "string", description: "One short sentence: why this slot." },
        },
      },
    },
  },
} as const;

/** The planner's instructions, written for the sections this person uses (lib/modules.ts). */
export function planSystem(modules: readonly string[]) {
  const school = modules.includes("school");
  const gym = modules.includes("gym");
  const clients = modules.includes("clients");
  const who = [school && "goes to school", clients && "does project work for clients"].filter(Boolean).join(" and ");
  const goals = [
    gym && "Gym on gym days (use the listed duration). If a gym day is listed as right after school, it already has its place.",
    school &&
      "Study time ONLY for the subjects listed under \"Tutoring\": homework and prep before each subject's next session. Never plan study for any other subject.",
    `${clients ? "Client project work and open tasks" : "Open tasks"}: earliest due date and highest priority first; split long tasks into blocks of at most 90 minutes.`,
    "Keep the evening lighter, leave short breaks between blocks, and never plan anything in the past.",
  ].filter(Boolean);
  return `You plan the week for someone${who ? ` who ${who}` : ""}.

Fixed commitments (${[school && "school", school && "tutoring", "Google Calendar events", "already-accepted blocks"].filter(Boolean).join(", ")}) can't move. Fill only the free slots you are given.

Goals, in order:
${goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}

Travel time is required. Every item has a place (${[school && "school", "home", gym && "gym", school && "a tutoring place", "or online = wherever they already are"].filter(Boolean).join(", ")}). Study, project and task blocks happen at home${gym ? "; gym at the gym" : ""}. Between two items in different places, the gap must be at least the travel time listed${gym ? " (gym → anywhere includes showering)" : ""}. The day starts and ends at home. Blocks that don't leave enough travel time are thrown away, so leave a few minutes extra.

Also recommend how many minutes per day to spend on ${[school && "study", "project work", gym && "gym"].filter(Boolean).join(", ")} (0 for anything they don't do), with a short note. Keep "advice" to 2–4 practical sentences.`;
}

export function buildPlanPrompt(opts: {
  now: { date: string; time: string };
  days: DayContext[];
  tasks: (PlanTask & { client: string | null })[];
  tutoring: { subject: string; weekday: number; start: string; end: string; everyWeeks: number; place: string }[];
  travel: Record<string, number>;
  dayStart: string;
  dayEnd: string;
  freeDayStart: string;
  gymExercises: Map<number, string>;
}) {
  const lines: string[] = [
    `Now: ${opts.now.date} ${opts.now.time}. Day window: ${opts.dayStart}–${opts.dayEnd}. On days without school, plan nothing before ${opts.freeDayStart}.`,
    "",
  ];
  for (const d of opts.days) {
    const dayFrom = d.schoolEnd == null ? Math.max(toMin(opts.dayStart), toMin(opts.freeDayStart)) : toMin(opts.dayStart);
    const start = d.date === opts.now.date ? Math.max(dayFrom, toMin(opts.now.time)) : dayFrom;
    const free = freeSlots(start, toMin(opts.dayEnd), d.busy, 30);
    lines.push(`## ${WEEKDAYS[d.weekday - 1]} ${d.date}`);
    lines.push(
      `Busy: ${d.busy.length ? d.busy.map((b) => `${toHHMM(b.start)}–${toHHMM(b.end)} ${b.title} @${b.place}`).join("; ") : "nothing"}`,
    );
    lines.push(`Gaps (before travel time): ${free.map((f) => `${toHHMM(f.start)}–${toHHMM(f.end)}`).join(", ") || "none"}`);
    if (d.gym) lines.push(`Gym day: ${d.gym.title}, ${d.gym.durationMin} min (${opts.gymExercises.get(d.weekday) ?? ""})`);
    if (d.study) lines.push(`Next tutoring after today: ${d.study.subject} on ${WEEKDAYS[d.study.sessionWeekday - 1]} ${d.study.sessionDate}`);
    lines.push("");
  }
  lines.push("## Tutoring (fixed)");
  if (!opts.tutoring.length) lines.push("None.");
  for (const t of opts.tutoring) {
    lines.push(`- ${t.subject}: ${WEEKDAYS[t.weekday - 1]}s ${t.start}–${t.end}${t.everyWeeks > 1 ? `, every ${t.everyWeeks} weeks` : ""} @${t.place}`);
  }
  lines.push("");
  lines.push("## Travel times (minutes, from > to; same place = 0; online needs none, except gym > online)");
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
