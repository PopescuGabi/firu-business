import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { env } from "../env";
import { anthropicKeyFor, aiAllowanceUsd } from "../users";
import { costUsd, monthStart, usd } from "./allowance";

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

export { PRICES } from "./allowance";

// One client per key (everyone uses the owner's key; see anthropicKeyFor).
const clients = new Map<string, Anthropic>();

/** Claude for this person, on the hub's key. */
export async function claude(uid: number) {
  const key = await anthropicKeyFor(uid);
  if (!key) throw new AiError("Claude isn't set up in this hub yet. Use the Claude app mode for now.", 503);
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
  // Everyone shares the owner's key, so members have a monthly allowance; the owner has none.
  const [u] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, uid));
  if (u?.role === "owner") return;
  const [spent, allowance] = await Promise.all([monthSpend(uid), aiAllowanceUsd()]);
  if (spent >= allowance) {
    throw new AiError(`You've used this month's AI allowance (${usd(allowance)}). It resets on the 1st.`, 429);
  }
}

/** Estimated USD this person's AI use has cost since the 1st of this month (UTC). */
export async function monthSpend(uid: number) {
  const db = await getDb();
  const rows = await db
    .select({
      model: schema.aiUsage.model,
      input: sql<number>`coalesce(sum(${schema.aiUsage.inputTokens}), 0)::int`,
      output: sql<number>`coalesce(sum(${schema.aiUsage.outputTokens}), 0)::int`,
    })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.userId, uid), gte(schema.aiUsage.createdAt, monthStart(new Date()))))
    .groupBy(schema.aiUsage.model);
  return costUsd(rows);
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
