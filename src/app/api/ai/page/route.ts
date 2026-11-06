import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { assertWithinLimit, claude, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { PAGE_JSON_SCHEMA, PROPOSE_SYSTEM } from "@/lib/ai/setup";
import { parsePageDraft } from "@/lib/custom-pages";
import { getPageById, pageItems } from "@/lib/custom-pages-db";

export const maxDuration = 300;

const body = z.object({ message: z.string().trim().min(1).max(4000), targetId: z.number().int().positive() });

const SYSTEM = `You help one person change the layout of one of their pages in a personal organiser.
You see the page's current spec and how many entries each collection has. When they ask for a change, call propose_page with the
complete new page (title, icon, colour, description and the whole spec), keeping everything they didn't ask to change, with the same
collection and field keys so existing entries keep their data. Never remove a collection that has entries unless they clearly ask.
Answer briefly. The building blocks and rules are below.

${PROPOSE_SYSTEM.split("\n").slice(2).join("\n")}`;

const pageTool = {
  name: "propose_page",
  description: "Propose the complete new layout for this page. The person reviews it and applies it with one tap.",
  input_schema: { ...PAGE_JSON_SCHEMA, properties: { summary: { type: "string", description: "One sentence: what changes." }, ...PAGE_JSON_SCHEMA.properties }, required: ["summary", ...PAGE_JSON_SCHEMA.required] },
};

/** "Edit with AI" on a custom page (Sonnet). Only the layout and entry counts go to Claude, never the entries. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { message, targetId } = parsed.data;
  const page = await getPageById(user.id, targetId);
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });

  let client: Anthropic;
  try {
    await assertWithinLimit(user.id);
    client = await claude(user.id);
  } catch (err) {
    const { message: m, status } = describeAiError(err);
    return Response.json({ error: m }, { status });
  }

  const items = await pageItems(user.id, page.id);
  const counts = page.spec.collections.map((c) => `${c.key}: ${items.filter((i) => i.collection === c.key).length} entries`).join(", ");
  const current = JSON.stringify({ title: page.title, icon: page.icon, color: page.color, description: page.description, spec: page.spec });
  const context = `Current page:\n${current}\n\nEntries: ${counts || "none"}`;

  const db = await getDb();
  const history = (
    await db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.userId, user.id), eq(schema.aiMessages.targetType, "page"), eq(schema.aiMessages.targetId, page.id)))
      .orderBy(desc(schema.aiMessages.id))
      .limit(12)
  ).reverse();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.role === "assistant" && m.proposal ? `${m.content}\n\n[Proposed layout${m.applied ? ", applied" : ""}]` : m.content,
  }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  messages.push({ role: "user", content: `${context}\n\n${message}` });
  await db.insert(schema.aiMessages).values({ userId: user.id, targetType: "page", targetId: page.id, role: "user", content: message });

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
          tools: [pageTool],
          tool_choice: { type: "auto" },
          messages,
        });
        s.on("text", (delta) => {
          text += delta;
          send({ type: "text", text: delta });
        });
        const final = await s.finalMessage();
        await recordUsage(user.id, "page-edit", final.usage, ai.model);
        if (final.stop_reason === "refusal") {
          send({ type: "error", error: "Claude declined this request. Try rephrasing it." });
          controller.close();
          return;
        }
        let proposal: unknown = null;
        const tool = final.content.find((b) => b.type === "tool_use");
        if (tool && tool.type === "tool_use" && final.stop_reason !== "max_tokens") {
          const { draft, problems } = parsePageDraft(tool.input);
          const summary = String((tool.input as { summary?: unknown }).summary ?? "").slice(0, 300);
          if (draft) proposal = { ...draft, summary };
          else send({ type: "error", error: `That layout didn't fit the building blocks (${problems[0] ?? "invalid"}). Ask again.` });
        }
        const content = text.trim() || (proposal ? (proposal as { summary: string }).summary : "");
        const [saved] = await db
          .insert(schema.aiMessages)
          .values({ userId: user.id, targetType: "page", targetId: page.id, role: "assistant", content, proposal })
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
