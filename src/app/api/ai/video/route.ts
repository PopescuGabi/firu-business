import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { extractJson } from "@/lib/ai/extract-json";
import { loadTargetContext } from "@/lib/ai/target";
import { buildVideoAsk, VIDEO_SYSTEM } from "@/lib/video/prompt";
import { videoSpec } from "@/lib/video/spec";

export const maxDuration = 300;

const attachment = z.object({
  id: z.string().max(80),
  name: z.string().max(200),
  kind: z.enum(["video", "image"]),
  url: z.string().max(2000).default(""),
  duration: z.number().nonnegative().max(36000).optional(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  note: z.string().max(300).optional(),
});
const body = z.object({
  reelId: z.number().int().positive(),
  brief: z.string().max(8000).default(""),
  attachments: z.array(attachment).max(20).default([]),
});

/** AI video maker: client input + Reels Brain → a VideoSpec. Without an Anthropic key, returns the prompt for the Claude app. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { reelId, brief, attachments } = parsed.data;
  const context = await loadTargetContext(user.id, "reel", reelId);
  if (!context) return Response.json({ error: "Reel not found" }, { status: 404 });
  const ask = buildVideoAsk(context, brief, attachments);

  if (!(await claudeAvailable(user.id))) return Response.json({ prompt: `${VIDEO_SYSTEM}\n\n${ask}` });
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor("content");
    const final = await (await claude(user.id)).beta.messages
      .stream({
        ...ai,
        max_tokens: 16000,
        output_config: { effort: "high" },
        system: [{ type: "text", text: VIDEO_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: ask }],
      })
      .finalMessage();
    await recordUsage(user.id, "video", final.usage, ai.model);
    if (final.stop_reason === "refusal") throw new Error("Claude declined this one.");
    const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    const json = extractJson(text);
    if (!json) throw new Error("Opus didn't return a video spec. Try again.");
    return Response.json({ spec: videoSpec.parse(json), context: `${context}\n${brief}` });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
