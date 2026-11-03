import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { claudeAvailable } from "./ai/claude";
import { getGoogleAccount } from "./google/oauth";
import type { ChatMessage } from "@/components/claude-panel";

export async function getEditorData(uid: number, targetType: "reel" | "carousel", targetId: number) {
  const db = await getDb();
  const [messages, prompts, account, claudeConfigured] = await Promise.all([
    db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.userId, uid), eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)))
      .orderBy(asc(schema.aiMessages.id)),
    db
      .select({ id: schema.prompts.id, name: schema.prompts.name, category: schema.prompts.category })
      .from(schema.prompts)
      .where(eq(schema.prompts.userId, uid))
      .orderBy(asc(schema.prompts.name)),
    getGoogleAccount(uid),
    claudeAvailable(uid),
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
    claudeConfigured,
    googleConnected: Boolean(account?.accessToken),
  };
}
