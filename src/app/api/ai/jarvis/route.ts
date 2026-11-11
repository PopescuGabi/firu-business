import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { jarvisContext, jarvisSystem } from "@/lib/ai/jarvis";

export const maxDuration = 120;

// The conversation lives in the browser tab; only the last few turns are sent.
const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(12),
});

export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const messages = parsed.data.messages;
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.at(-1)?.role !== "user") return Response.json({ error: "Say something first." }, { status: 400 });

  let client;
  let system;
  try {
    await assertWithinLimit(user.id);
    [client, system] = await Promise.all([claude(user.id), jarvisContext(user.id).then(jarvisSystem)]);
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }

  // NDJSON: {type:"text"} deltas as Claude writes, so speech can start on the first sentence; then {type:"done"} or {type:"error"}.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        // Sonnet: quick enough to talk to, sharp enough for business questions.
        const ai = modelFor("analysis");
        const s = client.beta.messages.stream({
          ...ai,
          max_tokens: 2000,
          output_config: { effort: "low" },
          system,
          messages,
        });
        s.on("text", (delta) => send({ type: "text", text: delta }));
        const final = await s.finalMessage();
        await recordUsage(user.id, "jarvis", final.usage, ai.model);
        if (final.stop_reason === "refusal") send({ type: "error", error: "Jarvis can't help with that one." });
        else send({ type: "done" });
      } catch (err) {
        send({ type: "error", error: describeAiError(err).message });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
