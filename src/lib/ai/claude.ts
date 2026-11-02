import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { gte, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { env } from "../env";

export const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if Opus declines, Anthropic re-runs on its recommended fallback model.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function claude() {
  if (!env.claudeConfigured()) throw new AiError("Claude isn't connected. Add ANTHROPIC_API_KEY in your environment.", 503);
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** API protection: hard cap on Claude calls per hour, counted in the database (works across instances). */
export async function assertWithinLimit() {
  const db = await getDb();
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiUsage)
    .where(gte(schema.aiUsage.createdAt, since));
  if (n >= env.aiMaxPerHour()) {
    throw new AiError(`Hourly Claude limit reached (${env.aiMaxPerHour()}/h). Try again later.`, 429);
  }
}

export async function recordUsage(kind: string, usage: { input_tokens: number; output_tokens: number } | undefined) {
  const db = await getDb();
  await db.insert(schema.aiUsage).values({
    kind,
    model: MODEL,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  });
}

export function describeAiError(err: unknown): { message: string; status: number } {
  if (err instanceof AiError) return { message: err.message, status: err.status };
  if (err instanceof Anthropic.AuthenticationError) return { message: "Anthropic API key is invalid.", status: 502 };
  if (err instanceof Anthropic.RateLimitError) return { message: "Anthropic rate limit hit. Wait a minute.", status: 429 };
  if (err instanceof Anthropic.BadRequestError) return { message: `Claude rejected the request: ${err.message}`, status: 502 };
  if (err instanceof Anthropic.APIError) return { message: `Claude API error (${err.status}).`, status: 502 };
  console.error(err);
  return { message: "Something went wrong talking to Claude.", status: 500 };
}
