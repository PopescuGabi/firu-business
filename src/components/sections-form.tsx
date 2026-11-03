"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { saveSections } from "@/app/actions/account";
import { MODULES, PRESETS } from "@/lib/modules";
import { Submit } from "./submit";
import { Field } from "./ui";

/**
 * Pick a starting preset or tick sections one by one. Used on first sign-in (with name and time zone)
 * and in Settings → Sections.
 */
export function SectionsForm({
  initial,
  onboarding,
  name,
  timezone,
}: {
  initial: string[];
  onboarding?: boolean;
  name?: string;
  timezone?: string;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [tz, setTz] = useState(timezone ?? "");
  useEffect(() => {
    if (onboarding && !timezone) setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [onboarding, timezone]);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const preset = PRESETS.find((p) => p.modules.length === picked.length && p.modules.every((m) => picked.includes(m)));

  return (
    <form action={saveSections} className="flex flex-col gap-5">
      {onboarding && <input type="hidden" name="next" value="home" />}
      <div className="grid gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPicked(p.modules)}
            className={clsx(
              "glass cursor-pointer rounded-2xl p-4 text-left transition",
              preset?.key === p.key ? "ring-2 ring-[var(--accent)]" : "hover:-translate-y-0.5",
            )}
          >
            <p className="text-[15px] font-semibold">{p.label}</p>
            <p className="mt-0.5 text-[13px] text-label-2">{p.description}</p>
          </button>
        ))}
      </div>
      <div className="glass divide-y divide-separator overflow-hidden rounded-2xl">
        {MODULES.map((m) => {
          const on = picked.includes(m.key);
          return (
            <label key={m.key} className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <input type="checkbox" name="modules" value={m.key} checked={on} onChange={() => toggle(m.key)} className="sr-only" />
              <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full border-2 transition", on ? "border-ink bg-ink text-on-ink" : "border-separator")}>
                {on && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{m.label}</span>
                <span className="block text-[13px] text-label-2">{m.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="px-1 text-[13px] text-label-2">Home, Today, Calendar and tasks are always there. You can change sections any time in Settings.</p>
      {onboarding && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name" hint="Used in the Home greeting.">
            <input name="displayName" maxLength={40} defaultValue={name} className="field" />
          </Field>
          <Field label="Time zone">
            <input name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} className="field" />
          </Field>
        </div>
      )}
      <Submit className="self-end">{onboarding ? "Start" : "Save sections"}</Submit>
    </form>
  );
}
