"use client";
import { useActionState } from "react";
import { saveJarvisVoice, type SpeechFormState } from "@/app/actions/speech";
import { buttonClass, Field } from "./ui";

/** Owner: the ElevenLabs key that gives Jarvis a natural voice and accurate hearing, and an optional voice ID. */
export function SpeechForm({ isSet, voice, defaultVoice }: { isSet: boolean; voice: string; defaultVoice: string }) {
  const [state, act, pending] = useActionState<SpeechFormState, FormData>(saveJarvisVoice, null);
  return (
    <form action={act} className="flex flex-col gap-3">
      <Field
        label="ElevenLabs API key"
        hint={
          isSet
            ? "A key is saved (encrypted). Jarvis speaks with ElevenLabs and transcribes you with Scribe. Paste a new one to replace it."
            : "elevenlabs.io → sign in → Developers → API keys → Create key (allow Text to Speech and Speech to Text). Until then Jarvis uses the browser's robotic voice."
        }
      >
        <input name="key" type="password" autoComplete="off" spellCheck={false} placeholder={isSet ? "Paste a new key to replace it" : "sk_…"} className="field font-mono" />
      </Field>
      <Field label="Voice ID (optional)" hint={`Empty = George, a warm British male voice (${defaultVoice}). To use another, copy its ID from the ElevenLabs Voice Library.`}>
        <input name="voice" defaultValue={voice} autoComplete="off" spellCheck={false} placeholder={defaultVoice} className="field font-mono" />
      </Field>
      <div className="flex items-center justify-end gap-2">
        {state && (
          <span role="status" className="text-[13px]" style={{ color: state.ok ? "var(--green)" : "var(--red)" }}>
            {state.message}
          </span>
        )}
        {isSet && (
          <button name="remove" value="1" className={buttonClass("gray")} disabled={pending}>
            Remove key
          </button>
        )}
        <button className={buttonClass("filled")} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
