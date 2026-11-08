"use client";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { saveClientProfile } from "@/app/actions/clients";
import { AWARENESS, AWARENESS_LABELS, OBJECTIVE_LABELS, OBJECTIVES, clientProfile, type ClientProfile } from "@/lib/client-profile";
import { Card, Field, Notice } from "./ui";
import { SaveIndicator, useAutosave } from "./use-autosave";

const TEXT: { key: keyof ClientProfile; label: string; hint: string; rows: number }[] = [
  { key: "audience", label: "Audience", hint: "Who, in what situation, at what moment do they watch?", rows: 2 },
  { key: "offer", label: "Offer", hint: "What they sell, the main service or programme.", rows: 2 },
  { key: "positioning", label: "Positioning", hint: "Why them and not the alternative, in one or two lines.", rows: 2 },
  { key: "voice", label: "Voice", hint: "Tone, tu / dumneavoastră, words to use or avoid.", rows: 2 },
  { key: "brand", label: "Brand system", hint: "Colours, fonts, recurring devices (counters, lower thirds), logo rules.", rows: 2 },
  { key: "constraints", label: "Constraints", hint: "Sector rules (e.g. CMR for clinics), consent, claims never to make.", rows: 3 },
  { key: "performance", label: "Observed results", hint: "Real numbers only, with dates and where they came from. Compare like with like.", rows: 3 },
];

/** The client's brand profile. Claude reads it for every reel and carousel of this client. */
export function ClientProfileForm({ clientId, initial }: { clientId: number; initial: unknown }) {
  const [p, setP] = useState<ClientProfile>(() => clientProfile.parse(initial ?? {}));
  const { state } = useAutosave(p, (v) => saveClientProfile(clientId, v));
  const set = <K extends keyof ClientProfile>(k: K, v: ClientProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const empty = !Object.values(p).some((v) => String(v).trim());

  return (
    <div className="space-y-4">
      {empty && (
        <Notice>
          Fill in who this client's videos are for. Opus reads this profile for every reel and carousel. Mark guesses as guesses.
        </Notice>
      )}
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <UserRound size={18} className="text-accent" />
          <p className="flex-1 text-[17px] font-semibold">Client profile</p>
          <SaveIndicator state={state} />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Awareness">
            <select value={p.awareness} onChange={(e) => set("awareness", e.target.value as ClientProfile["awareness"])} className="field">
              {AWARENESS.map((a) => (
                <option key={a} value={a}>
                  {AWARENESS_LABELS[a]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Main goal">
            <select value={p.goal} onChange={(e) => set("goal", e.target.value as ClientProfile["goal"])} className="field">
              {OBJECTIVES.map((o) => (
                <option key={o} value={o}>
                  {OBJECTIVE_LABELS[o]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Language">
            <input value={p.language} onChange={(e) => set("language", e.target.value)} className="field" placeholder="Română" />
          </Field>
          <Field label="Platforms">
            <input value={p.platforms} onChange={(e) => set("platforms", e.target.value)} className="field" placeholder="Instagram, Facebook" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <textarea value={String(p[f.key])} onChange={(e) => set(f.key, e.target.value as never)} rows={f.rows} className="field" />
            </Field>
          ))}
        </div>
      </Card>
    </div>
  );
}
