"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { saveSpeechKey } from "@/lib/speech";

export type SpeechFormState = { ok: boolean; message: string } | null;

/** Owner only: the ElevenLabs key and (optionally) a different voice for Jarvis. */
export async function saveJarvisVoice(_prev: SpeechFormState, fd: FormData): Promise<SpeechFormState> {
  const user = await requireUser();
  if (user.role !== "owner") return { ok: false, message: "Only the owner sets Jarvis's voice." };
  if (fd.get("remove") === "1") {
    await saveSpeechKey(user.id, null);
    revalidatePath("/", "layout");
    return { ok: true, message: "Removed. Jarvis uses the browser's voice again." };
  }
  const raw = String(fd.get("key") ?? "").trim();
  if (raw) {
    const key = z.string().regex(/^sk_[A-Za-z0-9]{48}$/, "That doesn't look like an ElevenLabs API key (sk_ followed by 48 letters and numbers).").safeParse(raw);
    if (!key.success) return { ok: false, message: key.error.issues[0].message };
    await saveSpeechKey(user.id, key.data);
  }
  const voice = String(fd.get("voice") ?? "").trim();
  if (voice && !/^[A-Za-z0-9]{10,40}$/.test(voice)) return { ok: false, message: "A voice ID is letters and numbers, like JBFqnCBsd6RMkjVDRZzb." };
  await setSetting(user.id, "jarvisVoiceId", voice);
  revalidatePath("/", "layout");
  return { ok: true, message: raw ? "Saved. Jarvis now speaks and listens with ElevenLabs." : "Saved." };
}
