import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { env } from "./env";
import { getGoogleAccount } from "./google/oauth";
import type { ChatMessage } from "@/components/claude-panel";

export async function getEditorData(targetType: "reel" | "carousel", targetId: number) {
  const db = await getDb();
  const [messages, prompts, account] = await Promise.all([
    db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)))
      .orderBy(asc(schema.aiMessages.id)),
    db
      .select({ id: schema.prompts.id, name: schema.prompts.name, category: schema.prompts.category })
      .from(schema.prompts)
      .orderBy(asc(schema.prompts.name)),
    getGoogleAccount(),
  ]);
  return {
    messages: messages.map<ChatMessage>((m) => ({
      id: m.id,
      role: m.role as ChatMessage["role"],
      content: m.content,
      proposal: m.proposal,
      applied: m.applied,
    })),
    prompts,
    claudeConfigured: env.claudeConfigured(),
    googleConnected: Boolean(account?.accessToken),
  };
}
