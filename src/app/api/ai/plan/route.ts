import { and, eq, gte, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { buildPlanPrompt, PLAN_SCHEMA, planOutput, planSystem, type PlanOutput } from "@/lib/ai/plan";
import { basicPlan, validateBlocks, type ProposedBlock } from "@/lib/planner";
import { getSettings, setSetting } from "@/lib/settings";
import { addDays, toHHMM, toMin } from "@/lib/time";
import { getWeek, nowMinutesIn, todayIn, toPlannerDays } from "@/lib/week";

export const maxDuration = 300;

const body = z.object({
  mode: z.enum(["ai", "basic"]).default("ai"),
  days: z.number().int().min(1).max(14).default(7),
});

export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { mode, days: numDays } = parsed.data;
  const useAi = mode === "ai";

  const db = await getDb();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const nowMin = nowMinutesIn(settings.timezone);
  const last = addDays(today, numDays - 1);

  const [{ days }, openTasks, clients] = await Promise.all([
    getWeek(user.id, today, numDays),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, user.id), eq(schema.tasks.done, false))),
    db.select().from(schema.clients).where(eq(schema.clients.userId, user.id)),
  ]);

  const plannerDays = toPlannerDays(days);
  const planOpts = { dayStart: settings.dayStart, dayEnd: settings.dayEnd, travel: settings.travel };
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
      await assertWithinLimit(user.id);
      const prompt = buildPlanPrompt({
        now: { date: today, time: toHHMM(nowMin) },
        days: plannerDays,
        tasks,
        dayStart: settings.dayStart,
        dayEnd: settings.dayEnd,
        travel: settings.travel,
      });
      const ai = modelFor("quick");
      const final = await (await claude(user.id))
        .beta.messages.stream({
          ...ai,
          max_tokens: 32000,
          output_config: { effort: "medium", format: { type: "json_schema", schema: PLAN_SCHEMA } },
          system: planSystem(user.modules),
          messages: [{ role: "user", content: prompt }],
        })
        .finalMessage();
      await recordUsage(user.id, "plan", final.usage, ai.model);
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
    .where(and(eq(schema.planBlocks.userId, user.id), eq(schema.planBlocks.status, "proposed"), ne(schema.planBlocks.kind, "post"), gte(schema.planBlocks.date, today), lte(schema.planBlocks.date, last)));
  if (valid.length) {
    await db.insert(schema.planBlocks).values(
      valid.map((b) => ({
        ...b,
        userId: user.id,
        taskId: b.taskId != null && taskIds.has(b.taskId) ? b.taskId : null,
        source,
        status: "proposed",
      })),
    );
  }

  const advice = { advice: output?.advice ?? "", dailyTargets: output?.dailyTargets ?? [], createdAt: new Date().toISOString(), source };
  await setSetting(user.id, "planAdvice", advice);

  return Response.json({ created: valid.length, dropped: blocks.length - valid.length, source, claudeConfigured: await claudeAvailable(user.id) });
}
