import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { requireApiUser, UnauthorizedError } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { assertWithinLimit, claude, describeAiError, FALLBACK_BETA, MODEL, recordUsage } from "@/lib/ai/claude";
import { carouselProposal, carouselTool, EDITOR_SYSTEM, reelProposal, reelTool, renderPrompts } from "@/lib/ai/editor";
import { loadPrompts, loadTargetContext } from "@/lib/ai/target";

export const maxDuration = 300;

const body = z.object({
  targetType: z.enum(["reel", "carousel"]),
  targetId: z.number().int().positive(),
  message: z.string().trim().min(1).max(20_000),
  promptIds: z.array(z.number().int()).max(30).default([]),
});

export async function POST(req: Request) {
  try {
    await requireApiUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: "Not signed in" }, { status: 401 });
    throw e;
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { targetType, targetId, message, promptIds } = parsed.data;

  const db = await getDb();
  const context = await loadTargetContext(targetType, targetId);
  if (!context) return Response.json({ error: `${targetType === "reel" ? "Reel" : "Carousel"} not found` }, { status: 404 });

  try {
    await assertWithinLimit();
    claude();
  } catch (err) {
    const { message: m, status } = describeAiError(err);
    return Response.json({ error: m }, { status });
  }

  const selected = await loadPrompts(targetType, promptIds);

  const history = (
    await db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)))
      .orderBy(desc(schema.aiMessages.id))
      .limit(20)
  ).reverse();

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content:
      m.role === "assistant" && m.proposal
        ? `${m.content}\n\n[Proposed edits${m.applied ? ", applied by the user" : ""}: ${JSON.stringify(m.proposal)}]`
        : m.content,
  }));
  // The API needs the conversation to start with the user.
  while (messages.length && messages[0].role !== "user") messages.shift();
  messages.push({ role: "user", content: `${context}\n\n${message}` });

  await db.insert(schema.aiMessages).values({ targetType, targetId, role: "user", content: message });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      let text = "";
      try {
        const s = claude().beta.messages.stream({
          model: MODEL,
          max_tokens: 64000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: "high" },
          system: [{ type: "text", text: EDITOR_SYSTEM + renderPrompts(selected), cache_control: { type: "ephemeral" } }],
          tools: [targetType === "reel" ? reelTool : carouselTool],
          tool_choice: { type: "auto" },
          messages,
        });
        s.on("text", (delta) => {
          text += delta;
          send({ type: "text", text: delta });
        });
        const final = await s.finalMessage();
        await recordUsage(`editor:${targetType}`, final.usage);

        if (final.stop_reason === "refusal") {
          send({ type: "error", error: "Claude declined this request. Try rephrasing it." });
          controller.close();
          return;
        }
        let proposal: unknown = null;
        const toolUse = final.content.find((b) => b.type === "tool_use");
        if (toolUse && toolUse.type === "tool_use" && final.stop_reason !== "max_tokens") {
          const schemaFor = targetType === "reel" ? reelProposal : carouselProposal;
          const result = schemaFor.safeParse(toolUse.input);
          if (result.success) proposal = result.data;
          else send({ type: "error", error: "Claude's proposal was malformed. Ask again." });
        }
        const content = text.trim() || (proposal ? (proposal as { summary: string }).summary : "");
        const [saved] = await db
          .insert(schema.aiMessages)
          .values({ targetType, targetId, role: "assistant", content, proposal })
          .returning({ id: schema.aiMessages.id });
        send({ type: "done", id: saved.id, content, proposal });
      } catch (err) {
        send({ type: "error", error: describeAiError(err).message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
