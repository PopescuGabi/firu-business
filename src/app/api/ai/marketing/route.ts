import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { getDb, schema } from "@/lib/db";
import { engagement, kindLabel, loadGoals, loadPosts, platformLabel, summarize, type PostRow } from "@/lib/marketing";
import { dayItems } from "@/lib/now-next";
import { getSettings } from "@/lib/settings";
import { addDays, toHHMM, toMin } from "@/lib/time";
import { HOOK_FORMULAS } from "@/lib/reels-brain/content";
import { getWeek, todayIn } from "@/lib/week";

export const maxDuration = 120;

const body = z.object({
  mode: z.enum(["report", "ideas", "plan", "summary"]),
  clientId: z.number().int().positive().optional(),
});

const SYSTEMS = {
  report: `You are a social media strategist reviewing one creator's posts (their own and their clients').
Write a short weekly report in plain English: what worked and why (hooks, format, platform, timing), what didn't, and exactly three things to do next week.
Use only the numbers given. Headings: "What worked", "What didn't", "Next week". Bullets, no fluff.
Compare only like with like (platform, format); one post is an anecdote, so say how confident each point is. Diagnose before style: topic → distribution → opening → pacing → payoff/offer.`,
  ideas: `You are a social media strategist. From the creator's best posts, suggest 6 new post ideas.
For each: a one-line idea, the format (reel / carousel / …), a scroll-stopping hook (first line or first 1–3 seconds) and a caption opener.
If writing instructions are given, follow their style and language.
Hooks must be true and self-contained, and align what's seen, written and said. Pay off any curiosity. No engagement bait, no invented numbers. Formula ideas: ${HOOK_FORMULAS.map((h) => h.name).join("; ")}.`,
  plan: `You plan when a creator should post during the coming week. Use their best days and hours (from the numbers), spread posts sensibly per client, and only use free times given.
Return 3 to 7 posts.`,
  summary: `Write a short, friendly performance update a creator can send to their client: what was posted, the results (views, engagement, best post), and what comes next.
4 to 8 sentences or bullets, no internal jargon, no money. Don't add a subject line or signature.`,
} as const;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string", description: "yyyy-mm-dd" },
          time: { type: "string", description: "HH:mm" },
          title: { type: "string", description: "e.g. Post reel for Albumescu" },
          reason: { type: "string" },
        },
        required: ["date", "time", "title", "reason"],
      },
    },
  },
  required: ["posts"],
} as const;
const planOut = z.object({ posts: z.array(z.object({ date: z.string(), time: z.string(), title: z.string().max(120), reason: z.string().max(300) })) });

const line = (p: PostRow, client: (id: number | null) => string) =>
  `- ${p.postedOn}${p.postedAt ? ` ${p.postedAt}` : ""} · ${platformLabel(p.platform)} ${kindLabel(p.kind)} · ${client(p.clientId)} · "${p.title}" · ${p.stats.views} views, ${p.stats.likes} likes, ${p.stats.comments} comments, ${p.stats.shares} shares, ${p.stats.saves} saves, ${p.stats.follows} follows (${engagement(p.stats).toFixed(1)}% engagement)`;

/** Claude's marketing help. Without an Anthropic key, returns the prompt for the Claude app instead. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { mode, clientId } = parsed.data;
  const db = await getDb();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const clients = await db.select({ id: schema.clients.id, name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.userId, user.id));
  if (clientId && !clients.some((c) => c.id === clientId)) return Response.json({ error: "Client not found" }, { status: 404 });
  if (mode === "summary" && !clientId) return Response.json({ error: "Pick a client first" }, { status: 400 });
  const clientName = (id: number | null) => clients.find((c) => c.id === id)?.name ?? "own";

  const posts = await loadPosts(user.id, clientId);
  if (!posts.length) return Response.json({ error: "Log a few posts with their numbers first." }, { status: 400 });
  const s = summarize(posts, today);
  const recent = posts.filter((p) => p.postedOn >= addDays(today, mode === "report" ? -28 : -90)).slice(0, 60);
  const goals = await loadGoals(user.id, clientId);
  const best = s.heat
    .flatMap((row, d) => row.map((v, h) => ({ d, h, v })))
    .filter((c) => c.v != null)
    .sort((a, b) => b.v! - a.v!)
    .slice(0, 5)
    .map((c) => `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][c.d]} ${String(c.h).padStart(2, "0")}:00 (${Math.round(c.v!)} avg views)`);

  let extra = "";
  if (mode === "ideas") {
    const prompts = await db.select().from(schema.prompts).where(eq(schema.prompts.userId, user.id));
    if (prompts.length) extra = `\n\nMy writing instructions:\n${prompts.map((p) => `## ${p.name}\n${p.body.slice(0, 3000)}`).join("\n\n")}`;
  }
  let free = "";
  if (mode === "plan") {
    const { days } = await getWeek(user.id, addDays(today, 1), 7);
    free = days
      .map((d) => {
        const busy = dayItems(d).map((i) => `${toHHMM(i.start)}–${toHHMM(i.end)}`);
        return `${d.date}: busy ${busy.join(", ") || "nothing"}; awake ${settings.dayStart}–${settings.dayEnd}`;
      })
      .join("\n");
  }
  const prompt = [
    `Today is ${today}.${clientId ? ` Client: ${clientName(clientId)}.` : ""}`,
    `Totals: ${s.total.views} views, ${s.engagement.toFixed(1)}% engagement over ${posts.length} posts. This month ${s.month.views} views (last month ${s.lastMonth.views}).`,
    `By platform: ${s.byPlatform.map((p) => `${p.label} ${p.posts} posts, ${p.views} views, ${p.engagement.toFixed(1)}%`).join("; ")}.`,
    `By type: ${s.byKind.map((k) => `${k.label} ${Math.round(k.avgViews)} avg views`).join("; ")}.`,
    best.length ? `Best posting slots so far: ${best.join(", ")}.` : "",
    goals.length ? `Goals: ${goals.map((g) => `${g.metric} ${g.metric === "engagement" ? g.target / 10 + "%" : g.target} per ${g.period}`).join("; ")}.` : "",
    `\nPosts:\n${recent.map((p) => line(p, clientName)).join("\n")}`,
    free ? `\nNext 7 days (plan posts only outside the busy times):\n${free}` : "",
    extra,
  ]
    .filter(Boolean)
    .join("\n");

  if (!(await claudeAvailable(user.id))) {
    const ask = mode === "plan" ? `${SYSTEMS.plan}\nGive each post as: day, time, what to post, why.` : SYSTEMS[mode];
    return Response.json({ prompt: `${ask}\n\n${prompt}` });
  }
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor(mode === "ideas" ? "content" : mode === "report" ? "analysis" : "quick");
    const final = await (await claude(user.id)).beta.messages
      .stream({
        ...ai,
        max_tokens: 8000,
        output_config: mode === "plan" ? { effort: "low", format: { type: "json_schema", schema: PLAN_SCHEMA } } : { effort: "low" },
        system: SYSTEMS[mode],
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();
    await recordUsage(user.id, `marketing-${mode}`, final.usage, ai.model);
    if (final.stop_reason === "refusal") throw new Error("Claude declined this one.");
    const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (mode !== "plan") return Response.json({ text });

    // Posting plan → 15-minute "post" suggestions in free time, shown in Calendar and Today.
    const out = planOut.parse(JSON.parse(text));
    const last = addDays(today, 7);
    const { days } = await getWeek(user.id, addDays(today, 1), 7);
    const valid = out.posts.filter((p) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.time) || p.date <= today || p.date > last) return false;
      const start = toMin(p.time);
      const day = days.find((d) => d.date === p.date);
      return start + 15 <= 24 * 60 && !(day && dayItems(day).some((i) => start < i.end && start + 15 > i.start));
    });
    await db
      .delete(schema.planBlocks)
      .where(and(eq(schema.planBlocks.userId, user.id), eq(schema.planBlocks.kind, "post"), eq(schema.planBlocks.status, "proposed"), gte(schema.planBlocks.date, today), lte(schema.planBlocks.date, last)));
    if (valid.length) {
      await db.insert(schema.planBlocks).values(
        valid.map((p) => ({ userId: user.id, date: p.date, start: p.time, end: toHHMM(toMin(p.time) + 15), title: p.title, kind: "post", reason: p.reason, status: "proposed", source: "ai" })),
      );
    }
    return Response.json({ text: valid.map((p) => `• ${p.date} ${p.time} — ${p.title}: ${p.reason}`).join("\n"), added: valid.length });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
