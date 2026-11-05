import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { env } from "../env";
import { anthropicKeyFor } from "../users";

export const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if the model declines, Anthropic re-runs on its recommended fallback model.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Which model does which job. The best model only writes content (reels, carousels, posts, scripts);
 * analysis runs on Sonnet and quick planning or summaries on Haiku, which is much faster and cheaper.
 */
export const MODELS = {
  content: "claude-opus-5-5", // reel / carousel editor, ideas & hooks for posts
  analysis: "claude-sonnet-5-5", // Brain review, weekly marketing report, gym coach
  quick: "claude-haiku-5-5", // Plan my week, posting plan, route advice, client summary, email, finance insights
} as const;
export type Tier = keyof typeof MODELS;

/** Model plus the refusal fallback where that model supports it (Haiku has no server-side fallback). */
export function modelFor(tier: Tier) {
  return tier === "quick"
    ? { model: MODELS.quick, betas: [] as string[] }
    : { model: MODELS[tier], betas: [FALLBACK_BETA], fallbacks: "default" as const };
}

/** List prices, USD per million tokens (input, output), for the usage estimate in Settings. */
export const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

// One client per key (each person brings their own; the owner may also use the deployment's key).
const clients = new Map<string, Anthropic>();

/** Claude for this person, with their own key. */
export async function claude(uid: number) {
  const key = await anthropicKeyFor(uid);
  if (!key) throw new AiError("Add your Anthropic API key in Settings to use Claude here, or use the Claude app mode.", 503);
  let c = clients.get(key);
  if (!c) clients.set(key, (c = new Anthropic({ apiKey: key })));
  return c;
}

/** Whether this person can use Claude in the site (otherwise the copy-paste Claude app mode). */
export async function claudeAvailable(uid: number) {
  return Boolean(await anthropicKeyFor(uid));
}

export class AiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** API protection: hard cap on each person's Claude calls per hour, counted in the database (works across instances). */
export async function assertWithinLimit(uid: number) {
  const db = await getDb();
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.userId, uid), gte(schema.aiUsage.createdAt, since)));
  if (n >= env.aiMaxPerHour()) {
    throw new AiError(`Hourly Claude limit reached (${env.aiMaxPerHour()}/h). Try again later.`, 429);
  }
}

export async function recordUsage(uid: number, kind: string, usage: { input_tokens: number; output_tokens: number } | undefined, model: string = MODEL) {
  const db = await getDb();
  await db.insert(schema.aiUsage).values({
    userId: uid,
    kind,
    model,
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
