import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { QUESTIONS_FORMAT, QUESTIONS_SYSTEM, questionsOut, tidyQuestions, whoSchema } from "@/lib/ai/setup";

export const maxDuration = 60;

/** AI setup, step 1: multiple-choice questions for this profession (Sonnet). */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = whoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Tell us what you do (2–80 characters)." }, { status: 400 });
  const { profession, wish } = parsed.data;
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor("analysis");
    const final = await (await claude(user.id)).beta.messages
      .stream({
        ...ai,
        max_tokens: 4000,
        output_config: { effort: "low", format: { type: "json_schema", schema: QUESTIONS_FORMAT } },
        system: QUESTIONS_SYSTEM,
        messages: [{ role: "user", content: `Profession: ${profession}${wish ? `\nWhat I want help with: ${wish}` : ""}` }],
      })
      .finalMessage();
    await recordUsage(user.id, "setup-questions", final.usage, ai.model);
    if (final.stop_reason === "refusal") throw new Error("Claude declined this one. Try describing your work differently.");
    const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return Response.json({ questions: tidyQuestions(questionsOut.parse(JSON.parse(text))) });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
