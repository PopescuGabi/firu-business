import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, FALLBACK_BETA, MODEL, recordUsage } from "@/lib/ai/claude";
import { loadTargetContext } from "@/lib/ai/target";
import { BRAIN_PROMPT } from "@/lib/reels-brain/prompt";

export const maxDuration = 180;

const body = z.object({ reelId: z.number().int().positive() });

const SYSTEM = `You review one short-form video (reel) for the user, a video editor working for clients, using their researched craft rules below.
Judge only what is in the reel text, plan and client profile; say when something can't be judged without seeing the footage.
Be specific and practical: every finding names the problem and the exact fix (rewritten line, timestamp, setting). Never invent numbers or results.
Write in the reel's language for rewritten lines, and in English for the rest.${BRAIN_PROMPT}`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", description: "One or two sentences: the biggest strength and the most important fix." },
    findings: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string", enum: ["hook", "story", "payoff", "cta", "captions", "motion", "audio", "platform", "truth"] },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          issue: { type: "string" },
          fix: { type: "string" },
        },
        required: ["area", "severity", "issue", "fix"],
      },
    },
    hooks: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          visual: { type: "string", description: "What is in frame 0" },
          text: { type: "string", description: "On-screen hook, ≤ 2 lines" },
          spoken: { type: "string", description: "First spoken line" },
          why: { type: "string" },
        },
        required: ["visual", "text", "spoken", "why"],
      },
    },
    captionPlan: {
      type: "object",
      additionalProperties: false,
      properties: {
        style: { type: "string", enum: ["phrase", "highlight", "karaoke", "none"] },
        why: { type: "string" },
        emphasis: { type: "array", items: { type: "string" }, maxItems: 8 },
      },
      required: ["style", "why", "emphasis"],
    },
  },
  required: ["verdict", "findings", "hooks", "captionPlan"],
} as const;

export const reviewOut = z.object({
  verdict: z.string(),
  findings: z.array(z.object({ area: z.string(), severity: z.enum(["high", "medium", "low"]), issue: z.string(), fix: z.string() })),
  hooks: z.array(z.object({ visual: z.string(), text: z.string(), spoken: z.string(), why: z.string() })),
  captionPlan: z.object({ style: z.enum(["phrase", "highlight", "karaoke", "none"]), why: z.string(), emphasis: z.array(z.string()) }),
});

/** Brain review of a reel. Without an Anthropic key, returns a prompt for the Claude app instead. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const context = await loadTargetContext(user.id, "reel", parsed.data.reelId);
  if (!context) return Response.json({ error: "Reel not found" }, { status: 404 });
  const ask = `Review this reel against the rules. Give: a verdict; up to 8 findings ordered by severity (area, severity, issue, fix); 3 hook options that align frame 0 + on-screen text + spoken line and are self-contained; and a caption plan (style, why, emphasis words).\n\n${context}`;

  if (!(await claudeAvailable(user.id))) {
    return Response.json({ prompt: `${SYSTEM}\n\n${ask}\n\nAnswer with headings: Verdict, Findings, Hook options, Caption plan.` });
  }
  try {
    await assertWithinLimit(user.id);
    const final = await (await claude(user.id)).beta.messages
      .stream({
        model: MODEL,
        max_tokens: 6000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: "user", content: ask }],
      })
      .finalMessage();
    await recordUsage(user.id, "brain-review", final.usage);
    if (final.stop_reason === "refusal") throw new Error("Claude declined this one.");
    const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    return Response.json({ review: reviewOut.parse(JSON.parse(text)) });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
