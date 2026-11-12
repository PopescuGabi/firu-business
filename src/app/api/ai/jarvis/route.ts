import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { JARVIS_TOOLS, jarvisContext, jarvisSystem, runJarvisTool, todaySchedule } from "@/lib/ai/jarvis";
import { getSettings } from "@/lib/settings";

export const maxDuration = 120;

// The conversation lives in the browser tab; only the last few turns are sent.
const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(12),
  /** The morning briefing: Jarvis organises today first, then walks through it. */
  briefing: z.boolean().default(false),
});

const MAX_ROUNDS = 6;

export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { messages, briefing } = parsed.data;
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.at(-1)?.role !== "user") return Response.json({ error: "Say something first." }, { status: 400 });

  let client;
  let system;
  try {
    await assertWithinLimit(user.id);
    [client, system] = await Promise.all([claude(user.id), jarvisContext(user.id, user.modules).then((c) => jarvisSystem(c, briefing))]);
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }

  // plan_day reuses the planner route on this same signed-in session (rule-based plan: instant and free).
  const cookie = req.headers.get("cookie") ?? "";
  const planDay = async () => {
    const res = await fetch(new URL("/api/ai/plan", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ mode: "basic", days: 1 }),
    });
    const j = (await res.json().catch(() => ({}))) as { created?: number; error?: string };
    if (!res.ok) return `Planning failed: ${j.error ?? res.status}.`;
    return `Planned ${j.created ?? 0} work block(s). Today now: ${await todaySchedule(user.id)}`;
  };

  // NDJSON: {type:"text"} deltas as Claude writes (speech starts on the first sentence), {type:"action"} when a tool
  // changed something, then {type:"done", changed} or {type:"error"}.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      let changed = false;
      try {
        // Opus: the strongest model, so Jarvis understands loose spoken requests and plans well; low effort keeps it quick.
        const ai = modelFor("content");
        const tz = (await getSettings(user.id)).timezone;
        const convo: { role: "user" | "assistant"; content: unknown }[] = messages.map((m) => ({ role: m.role, content: m.content }));
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const s = client.beta.messages.stream({
            ...ai,
            max_tokens: 2000,
            output_config: { effort: "low" },
            system,
            tools: JARVIS_TOOLS,
            // On the briefing's first round the plan must happen before anything is said.
            tool_choice: briefing && round === 0 ? { type: "tool", name: "plan_day" } : { type: "auto" },
            messages: convo as never,
          });
          s.on("text", (delta) => send({ type: "text", text: delta }));
          const final = await s.finalMessage();
          await recordUsage(user.id, "jarvis", final.usage, ai.model);
          if (final.stop_reason === "refusal") {
            send({ type: "error", error: "I'm afraid I can't help with that one." });
            break;
          }
          const uses = final.content.filter((b) => b.type === "tool_use");
          if (final.stop_reason !== "tool_use" || uses.length === 0) break;
          convo.push({ role: "assistant", content: final.content });
          const results = [];
          for (const u of uses) {
            if (u.type !== "tool_use") continue;
            const out = await runJarvisTool(u.name, (u.input ?? {}) as Record<string, unknown>, { uid: user.id, tz, planDay }).catch((e: Error) => ({
              result: `Failed: ${e.message}`,
              action: undefined,
            }));
            if (out.action) {
              changed = true;
              send({ type: "action", text: out.action });
            }
            results.push({ type: "tool_result", tool_use_id: u.id, content: out.result });
          }
          convo.push({ role: "user", content: results });
        }
        send({ type: "done", changed });
      } catch (err) {
        send({ type: "error", error: describeAiError(err).message });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
