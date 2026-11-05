import { and, asc, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { fmtSet, formatExercises, gymProposal, gymTool } from "@/lib/gym";
import { dayItems } from "@/lib/now-next";
import { getSettings } from "@/lib/settings";
import { addDays, toHHMM, WEEKDAYS } from "@/lib/time";
import { getWeek, todayIn } from "@/lib/week";

export const maxDuration = 300;

const body = z.object({ message: z.string().trim().min(1).max(8000) });

const SYSTEM = `You are a practical gym coach inside a personal organiser. You help one person shape their weekly gym split.
- Keep their training days, timing and session length unless they ask to change them or something clearly doesn't fit their week.
- Realistic volume: roughly 10–20 hard sets per muscle group per week, compound lifts first, sessions that fit the minutes given (about 3–4 minutes per set including rest, plus warm-up).
- They log every set (kg × reps). The app suggests +2.5 kg once every set reaches the target reps (10 when none is set), otherwise +1 rep. Use their logged sets to spot stalls (same top set for 3+ sessions → suggest a deload or a variation) and give each exercise a fitting target reps in proposals.
- Answer briefly and concretely. No medical advice: for pain, injury or health conditions, tell them to see a doctor or physiotherapist first.
- Whenever you suggest changing the split, call propose_split with the full new workout for each day that changes, so they can apply it with one tap. Don't list the same changes again in the text.`;

/** The split and the week around it. Only workouts and busy times go to Claude; no names, places or emails. */
async function gymContext(uid: number) {
  const db = await getDb();
  const settings = await getSettings(uid);
  const today = todayIn(settings.timezone);
  const [gym, { days }, logs] = await Promise.all([
    db.select().from(schema.gymDays).where(eq(schema.gymDays.userId, uid)),
    getWeek(uid, today, 7),
    db
      .select()
      .from(schema.gymSets)
      .where(and(eq(schema.gymSets.userId, uid), gte(schema.gymSets.date, addDays(today, -28))))
      .orderBy(asc(schema.gymSets.date), asc(schema.gymSets.exercise), asc(schema.gymSets.setNo)),
  ]);
  const split = gym.length
    ? gym
        .sort((a, b) => a.weekday - b.weekday)
        .map(
          (g) =>
            `${WEEKDAYS[g.weekday - 1]} (weekday ${g.weekday}) · ${g.title} · ${g.durationMin} min · ${g.timing === "fixed" ? `fixed at ${g.startTime}` : g.timing.replace("_", " ")}\n${formatExercises(g.exercises)}`,
        )
        .join("\n\n")
    : "No gym days yet.";
  const week = days
    .map((d) => {
      const busy = dayItems(d)
        .filter((i) => i.kind !== "gym")
        .map((i) => `${toHHMM(i.start)}–${toHHMM(i.end)}`);
      return `${WEEKDAYS[d.weekday - 1]}: busy ${busy.join(", ") || "nothing fixed"}`;
    })
    .join("\n");
  const sessions = new Map<string, string[]>();
  for (const l of logs) {
    const key = `${l.date} ${l.exercise}`;
    sessions.set(key, [...(sessions.get(key) ?? []), fmtSet(l)]);
  }
  const logged = sessions.size
    ? [...sessions.entries()].map(([k, sets]) => `${k}: ${sets.join(", ")}`).join("\n")
    : "Nothing logged yet.";
  return `Current split (exercise × sets × target reps):\n${split}\n\nLogged sets, last 4 weeks (today is ${today}):\n${logged}\n\nTheir week (awake ${settings.dayStart}–${settings.dayEnd}; ${settings.gymExtraMinutes} min extra after the gym to shower and change):\n${week}`;
}

/** Gym coach chat (Sonnet). Streams NDJSON like the reel editor. Without an Anthropic key, returns the prompt for the Claude app. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { message } = parsed.data;
  if (!user.modules.includes("gym")) return Response.json({ error: "Turn on the Gym section first" }, { status: 400 });

  const context = await gymContext(user.id);
  if (!(await claudeAvailable(user.id))) return Response.json({ prompt: `${SYSTEM.split("\n- Whenever")[0]}\n\n${context}\n\n${message}` });

  let client: Anthropic;
  try {
    await assertWithinLimit(user.id);
    client = await claude(user.id);
  } catch (err) {
    const { message: m, status } = describeAiError(err);
    return Response.json({ error: m }, { status });
  }

  const db = await getDb();
  const history = (
    await db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.userId, user.id), eq(schema.aiMessages.targetType, "gym"), eq(schema.aiMessages.targetId, 0)))
      .orderBy(desc(schema.aiMessages.id))
      .limit(20)
  ).reverse();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content:
      m.role === "assistant" && m.proposal
        ? `${m.content}\n\n[Proposed split changes${m.applied ? ", applied by the user" : ""}: ${JSON.stringify(m.proposal)}]`
        : m.content,
  }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  messages.push({ role: "user", content: `${context}\n\n${message}` });
  await db.insert(schema.aiMessages).values({ userId: user.id, targetType: "gym", targetId: 0, role: "user", content: message });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      let text = "";
      try {
        const ai = modelFor("analysis");
        const s = client.beta.messages.stream({
          ...ai,
          max_tokens: 16000,
          output_config: { effort: "medium" },
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          tools: [gymTool],
          tool_choice: { type: "auto" },
          messages,
        });
        s.on("text", (delta) => {
          text += delta;
          send({ type: "text", text: delta });
        });
        const final = await s.finalMessage();
        await recordUsage(user.id, "gym", final.usage, ai.model);
        if (final.stop_reason === "refusal") {
          send({ type: "error", error: "Claude declined this request. Try rephrasing it." });
          controller.close();
          return;
        }
        let proposal: unknown = null;
        const toolUse = final.content.find((b) => b.type === "tool_use");
        if (toolUse && toolUse.type === "tool_use" && final.stop_reason !== "max_tokens") {
          const result = gymProposal.safeParse(toolUse.input);
          if (result.success) proposal = result.data;
          else send({ type: "error", error: "Claude's split didn't fit the limits (max 15 exercises, 1–10 sets, 15–240 min). Ask again." });
        }
        const content = text.trim() || (proposal ? (proposal as { summary: string }).summary : "");
        const [saved] = await db
          .insert(schema.aiMessages)
          .values({ userId: user.id, targetType: "gym", targetId: 0, role: "assistant", content, proposal })
          .returning({ id: schema.aiMessages.id });
        send({ type: "done", id: saved.id, content, proposal });
      } catch (err) {
        send({ type: "error", error: describeAiError(err).message });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
