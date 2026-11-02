"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { buildClaudeAppPrompt, carouselProposal, reelProposal } from "@/lib/ai/editor";
import { extractJson } from "@/lib/ai/extract-json";
import { loadPrompts, loadTargetContext } from "@/lib/ai/target";
import type { ChatMessage } from "@/components/claude-panel";

const target = z.object({ targetType: z.enum(["reel", "carousel"]), targetId: z.number().int().positive() });

/** Builds the prompt to paste into the Claude app and logs the request in this chat. */
export async function prepareClaudePrompt(input: { targetType: "reel" | "carousel"; targetId: number; promptIds: number[]; request: string }) {
  await requireUser();
  const { targetType, targetId } = target.parse(input);
  const request = z.string().trim().min(1).max(20_000).parse(input.request);
  const promptIds = z.array(z.number().int()).max(30).parse(input.promptIds);
  const context = await loadTargetContext(targetType, targetId);
  if (!context) throw new Error("Not found");
  const text = buildClaudeAppPrompt({ targetType, context, prompts: await loadPrompts(targetType, promptIds), request });
  const db = await getDb();
  const [m] = await db
    .insert(schema.aiMessages)
    .values({ targetType, targetId, role: "user", content: request })
    .returning();
  const message: ChatMessage = { id: m.id, role: "user", content: m.content, proposal: null, applied: false };
  return { text, message };
}

/** Reads a reply pasted from the Claude app; edits become an "Apply changes" card. */
export async function importClaudeReply(input: { targetType: "reel" | "carousel"; targetId: number; reply: string }) {
  await requireUser();
  const { targetType, targetId } = target.parse(input);
  const reply = z.string().trim().min(1).max(200_000).parse(input.reply);
  const json = extractJson(reply);
  let proposal: unknown = null;
  if (json) {
    const parsed = (targetType === "reel" ? reelProposal : carouselProposal).safeParse(json);
    if (!parsed.success) {
      return { error: "The reply has an edit block, but it isn't in the expected shape. Ask Claude to resend the JSON exactly as requested." };
    }
    proposal = parsed.data;
  }
  // The note Claude wrote before the JSON (or the whole answer when there are no edits).
  const note = (json ? reply.slice(0, reply.search(/```|\{/)) : reply).trim().slice(0, 4000);
  const content = note || (proposal as { summary?: string } | null)?.summary || "";
  const db = await getDb();
  const [m] = await db
    .insert(schema.aiMessages)
    .values({ targetType, targetId, role: "assistant", content, proposal })
    .returning();
  const message: ChatMessage = { id: m.id, role: "assistant", content: m.content, proposal: m.proposal, applied: false };
  return { message };
}
