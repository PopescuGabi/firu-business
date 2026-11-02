import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { assertWithinLimit, claude, describeAiError, FALLBACK_BETA, MODEL, recordUsage } from "@/lib/ai/claude";
import { buildPlanPrompt, PLAN_SCHEMA, PLAN_SYSTEM, planOutput, type PlanOutput } from "@/lib/ai/plan";
import { env } from "@/lib/env";
import { basicPlan, validateBlocks, type DayContext, type ProposedBlock } from "@/lib/planner";
import { nextSessionAfter } from "@/lib/tutoring";
import { getSettings } from "@/lib/settings";
import { addDays, toHHMM, toMin } from "@/lib/time";
import { getWeek, nowMinutesIn, todayIn, toPlannerDays } from "@/lib/week";

export const maxDuration = 300;

const body = z.object({
  mode: z.enum(["ai", "basic"]).default("ai"),
  days: z.number().int().min(1).max(14).default(7),
});

export async function POST(req: Request) {
  try {
    await requireApiUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { mode, days: numDays } = parsed.data;
  const useAi = mode === "ai";

  const db = await getDb();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const nowMin = nowMinutesIn(settings.timezone);
  const last = addDays(today, numDays - 1);

  const [{ days }, tutoring, gym, openTasks, clients] = await Promise.all([
    getWeek(today, numDays),
    db.select().from(schema.tutoring),
    db.select().from(schema.gymDays),
    db.select().from(schema.tasks).where(eq(schema.tasks.done, false)),
    db.select().from(schema.clients),
  ]);

  // Study time only for tutoring subjects: prep for the next session after each day.
  const study = new Map<string, DayContext["study"]>();
  for (const d of days) {
    const next = nextSessionAfter(tutoring, d.date);
    if (next) study.set(d.date, { subject: next.session.subject, sessionDate: next.date, sessionWeekday: next.session.weekday });
  }

  const plannerDays = toPlannerDays(days, study);
  const planOpts = { dayStart: settings.dayStart, dayEnd: settings.dayEnd, freeDayStart: settings.freeDayStart, travel: settings.travel };
  // Nothing may be planned in the past.
  const todayCtx = plannerDays.find((d) => d.date === today);
  if (todayCtx) todayCtx.busy.push({ start: 0, end: nowMin, title: "Past", kind: "past", place: "any" });

  const tasks = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    due: t.due,
    estimateMin: t.estimateMin,
    priority: t.priority,
    client: clients.find((c) => c.id === t.clientId)?.name ?? null,
  }));

  let blocks: ProposedBlock[];
  let output: PlanOutput | null = null;
  let source: "ai" | "basic" = "basic";

  if (useAi) {
    try {
      await assertWithinLimit();
      const prompt = buildPlanPrompt({
        now: { date: today, time: toHHMM(nowMin) },
        days: plannerDays,
        tasks,
        dayStart: settings.dayStart,
        dayEnd: settings.dayEnd,
        freeDayStart: settings.freeDayStart,
        tutoring,
        travel: settings.travel,
        gymExercises: new Map(gym.map((g) => [g.weekday, g.exercises.map((e) => `${e.name} ${e.sets}x`).join(", ")])),
      });
      const final = await claude()
        .beta.messages.stream({
          model: MODEL,
          max_tokens: 32000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: "medium", format: { type: "json_schema", schema: PLAN_SCHEMA } },
          system: PLAN_SYSTEM,
          messages: [{ role: "user", content: prompt }],
        })
        .finalMessage();
      await recordUsage("plan", final.usage);
      if (final.stop_reason === "refusal") throw new Error("Claude declined to plan this week.");
      const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      output = planOutput.parse(JSON.parse(text));
      blocks = output.blocks;
      source = "ai";
    } catch (err) {
      return Response.json({ error: describeAiError(err).message }, { status: describeAiError(err).status });
    }
  } else {
    blocks = basicPlan(plannerDays, tasks, planOpts);
  }

  const valid = validateBlocks(blocks, plannerDays, planOpts).filter(
    (b) => b.date !== today || toMin(b.start) >= nowMin,
  );
  const taskIds = new Set(openTasks.map((t) => t.id));
  // Proposed (not yet accepted) blocks are replaced by the new plan, only once it succeeded.
  await db
    .delete(schema.planBlocks)
    .where(and(eq(schema.planBlocks.status, "proposed"), gte(schema.planBlocks.date, today), lte(schema.planBlocks.date, last)));
  if (valid.length) {
    await db.insert(schema.planBlocks).values(
      valid.map((b) => ({
        ...b,
        taskId: b.taskId != null && taskIds.has(b.taskId) ? b.taskId : null,
        source,
        status: "proposed",
      })),
    );
  }

  const advice = { advice: output?.advice ?? "", dailyTargets: output?.dailyTargets ?? [], createdAt: new Date().toISOString(), source };
  await db
    .insert(schema.settings)
    .values({ key: "planAdvice", value: advice })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: advice } });

  return Response.json({ created: valid.length, dropped: blocks.length - valid.length, source, claudeConfigured: env.claudeConfigured() });
}
