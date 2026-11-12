import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { SpeechError, speechKey, synthesize } from "@/lib/speech";

export const maxDuration = 60;

// One sentence or a few at a time: Jarvis speaks while the rest of the reply is still being written.
const body = z.object({ text: z.string().trim().min(1).max(1200), lang: z.enum(["en", "ro"]).default("en") });

export async function POST(req: Request) {
  const { denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const key = await speechKey();
  if (!key) return Response.json({ error: "No ElevenLabs key yet (Settings → Jarvis voice)." }, { status: 503 });
  try {
    const audio = await synthesize(key, parsed.data.text, parsed.data.lang);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    const e = err instanceof SpeechError ? err : new SpeechError("Couldn't reach ElevenLabs.");
    return Response.json({ error: e.message }, { status: e.status });
  }
}
