import "server-only";
import { asc, eq } from "drizzle-orm";
import { decrypt, encrypt } from "./crypto";
import { getDb, schema } from "./db";
import { getSetting, setSetting } from "./settings";

/*
 * Jarvis's voice and hearing, through ElevenLabs (one key, set by the owner in Settings → Jarvis voice):
 * - voice: text-to-speech with eleven_v4_turbo, their expressive real-time model (Romanian and English)
 * - hearing: speech-to-text with Scribe v3, which detects the language itself
 * Without a key, the browser's own (robotic) voice and recogniser are used instead.
 */

export const TTS_MODEL = "eleven_v4_turbo";
export const STT_MODEL = "scribe_v3";
/** ElevenLabs' premade "George": a warm, mature British male narrator. Replaceable in Settings. */
export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const API = "https://api.elevenlabs.io/v1";

export class SpeechError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/** The owner's key (everyone in the hub uses it), else ELEVENLABS_API_KEY from the environment. */
export async function speechKey(): Promise<string | null> {
  const db = await getDb();
  const [owner] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "owner")).orderBy(asc(schema.users.id)).limit(1);
  if (owner) {
    const stored = await getSetting<string>(owner.id, "elevenlabsKey");
    if (stored) {
      try {
        return decrypt(stored);
      } catch {
        // The stored key can't be read (secret rotated); fall through to the environment.
      }
    }
  }
  return process.env.ELEVENLABS_API_KEY || null;
}

export async function saveSpeechKey(ownerId: number, key: string | null) {
  await setSetting(ownerId, "elevenlabsKey", key ? encrypt(key) : ""); // "" = removed (the value column is required)
}

export async function voiceId(): Promise<string> {
  const db = await getDb();
  const [owner] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "owner")).orderBy(asc(schema.users.id)).limit(1);
  const v = owner ? await getSetting<string>(owner.id, "jarvisVoiceId") : null;
  return v && /^[A-Za-z0-9]{10,40}$/.test(v) ? v : DEFAULT_VOICE_ID;
}

async function failure(res: Response, what: string) {
  const body = await res.text().catch(() => "");
  if (res.status === 401 || /invalid_api_key|authentication_error/.test(body)) return new SpeechError("The ElevenLabs key was refused. Check it in Settings → Jarvis voice.", 502);
  if (res.status === 429) return new SpeechError("ElevenLabs is busy or out of credits. Try again shortly.", 429);
  if (/quota|credits/i.test(body)) return new SpeechError("Your ElevenLabs credits have run out for this month.", 402);
  return new SpeechError(`ElevenLabs ${what} failed (${res.status}).`, 502);
}

/** Streams spoken audio (MP3) for one piece of text. */
export async function synthesize(key: string, text: string, lang: "en" | "ro") {
  const res = await fetch(`${API}/text-to-speech/${await voiceId()}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      language_code: lang,
      // A little variation (lower stability) and some style read as human; speed stays natural.
      voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 1.0 },
    }),
  });
  if (!res.ok || !res.body) throw await failure(res, "speech");
  return res.body;
}

/** Transcribes one recorded request. The language is detected automatically (Romanian, English, mixed). */
export async function transcribe(key: string, audio: Blob, filename: string) {
  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append("file", audio, filename);
  form.append("tag_audio_events", "false");
  const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: form });
  if (!res.ok) throw await failure(res, "transcription");
  const j = (await res.json()) as { text?: string; language_code?: string };
  return { text: (j.text ?? "").trim(), language: j.language_code ?? null };
}
