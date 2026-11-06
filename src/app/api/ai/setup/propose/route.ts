import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { answersSchema, PROPOSE_SYSTEM, proposeTool, tidyProposal, whoSchema } from "@/lib/ai/setup";
import { listPages } from "@/lib/custom-pages-db";

export const maxDuration = 300;

const body = whoSchema.extend({ answers: answersSchema });

/** AI setup, step 2: sections + custom pages for this person (Sonnet). Nothing is saved until they confirm. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { profession, wish, answers } = parsed.data;
  const existing = (await listPages(user.id)).map((p) => p.title);
  const prompt = [
    `Profession: ${profession}`,
    wish && `What I want help with: ${wish}`,
    `My answers:\n${answers.map((a) => `- ${a.question} → ${[...a.picked, a.other].filter(Boolean).join("; ") || "(skipped)"}`).join("\n")}`,
    `Sections I already use: ${user.modules.join(", ") || "none"}.`,
    existing.length && `Pages I already have (don't duplicate them): ${existing.join(", ")}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor("analysis");
    const final = await (await claude(user.id)).beta.messages
      .stream({
        ...ai,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        system: PROPOSE_SYSTEM,
        tools: [proposeTool],
        // Sonnet 5.5 doesn't accept a forced tool; the system prompt asks for exactly one propose_setup call.
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: prompt }],
      })
      .finalMessage();
    await recordUsage(user.id, "setup-propose", final.usage, ai.model);
    if (final.stop_reason === "refusal") throw new Error("Claude declined this one. Try describing your work differently.");
    if (final.stop_reason === "max_tokens") throw new Error("The proposal was too long. Try again.");
    const tool = final.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") throw new Error("Claude answered without a setup. Press Build my pages again.");
    const proposal = tidyProposal(tool.input);
    if (!proposal.pages.length && !proposal.modules.length) throw new Error("That setup didn't work out. Try again.");
    return Response.json({ proposal });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status: err instanceof z.ZodError ? 502 : status });
  }
}
