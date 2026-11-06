import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { assertWithinLimit, claude, claudeAvailable, describeAiError, modelFor, recordUsage } from "@/lib/ai/claude";
import { CLIENT_TOOLS, isClientTool } from "@/lib/client-tools";

const body = z.object({ name: z.string().trim().max(200).default(""), businessType: z.string().max(40).default(""), brief: z.string().trim().min(3).max(1000) });

const SYSTEM = `You help a marketing professional set up a client in their app. From the client's business and the brief, pick only the tools this client really needs (nothing extra):
${CLIENT_TOOLS.map((t) => `- ${t.key}: ${t.description}`).join("\n")}
Answer with the tool keys and one short sentence why.`;

const FORMAT = {
  type: "object",
  additionalProperties: false,
  properties: { tools: { type: "array", items: { type: "string", enum: CLIENT_TOOLS.map((t) => t.key) } }, why: { type: "string" } },
  required: ["tools", "why"],
} as const;

/** "Suggest with AI" on the client form (Haiku): which tools this business needs. */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a line about the client first." }, { status: 400 });
  if (!(await claudeAvailable(user.id))) return Response.json({ error: "Claude isn't set up in this hub yet." }, { status: 400 });
  const { name, businessType, brief } = parsed.data;
  try {
    await assertWithinLimit(user.id);
    const ai = modelFor("quick");
    const final = await (await claude(user.id)).beta.messages
      .stream({
        ...ai,
        max_tokens: 600,
        output_config: { effort: "low", format: { type: "json_schema", schema: FORMAT } },
        system: SYSTEM,
        messages: [{ role: "user", content: `Client: ${name || "(unnamed)"}\nType: ${businessType || "not given"}\nBrief: ${brief}` }],
      })
      .finalMessage();
    await recordUsage(user.id, "client-tools", final.usage, ai.model);
    const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const out = z.object({ tools: z.array(z.string()), why: z.string().max(300).catch("") }).parse(JSON.parse(text));
    return Response.json({ tools: out.tools.filter(isClientTool), why: out.why });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return Response.json({ error: message }, { status });
  }
}
