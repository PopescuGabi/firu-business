import { apiUser } from "@/lib/auth";
import { SpeechError, speechKey, transcribe } from "@/lib/speech";

export const maxDuration = 60;
const MAX_BYTES = 8 * 1024 * 1024; // about two minutes of speech

/** A recorded request (multipart field "audio") → its text, in whatever language was spoken. */
export async function POST(req: Request) {
  const { denied } = await apiUser();
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "No audio received." }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "That recording is too long." }, { status: 413 });
  const key = await speechKey();
  if (!key) return Response.json({ error: "No ElevenLabs key yet (Settings → Jarvis voice)." }, { status: 503 });
  try {
    const name = audio instanceof File && audio.name ? audio.name : "request.webm";
    return Response.json(await transcribe(key, audio, name));
  } catch (err) {
    const e = err instanceof SpeechError ? err : new SpeechError("Couldn't reach ElevenLabs.");
    return Response.json({ error: e.message }, { status: e.status });
  }
}
