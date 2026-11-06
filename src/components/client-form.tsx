"use client";
import { useState } from "react";
import clsx from "clsx";
import { Check, Sparkles } from "lucide-react";
import { BUSINESS_TYPES, CLIENT_TOOLS, toolsFor } from "@/lib/client-tools";
import { Submit } from "./submit";
import { buttonClass, Field } from "./ui";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#5856D6", "#30B0C7", "#FF3B30", "#8E8E93"];

/**
 * A client business: name, type, a short brief and the tools it needs. Picking a type ticks its usual tools;
 * "Suggest with AI" reads the brief. Only the ticked tools appear on the client's page.
 */
export function ClientForm({
  action,
  client,
  submitLabel = "Create client",
  aiOn = false,
}: {
  action: (fd: FormData) => Promise<void>;
  client?: { name: string; description: string; appName: string; color: string; businessType: string; features: string[] };
  submitLabel?: string;
  aiOn?: boolean;
}) {
  const [type, setType] = useState(client?.businessType ?? "");
  const [tools, setTools] = useState<string[]>(client?.features ?? ["instagram"]);
  const [name, setName] = useState(client?.name ?? "");
  const [brief, setBrief] = useState(client?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function suggest() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/ai/client-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, businessType: type, brief }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't suggest tools");
      if (data.tools?.length) setTools(data.tools);
      setNote(data.why || null);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't suggest tools");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Business name">
        <input name="name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className="field" autoFocus />
      </Field>
      <Field label="Type of business">
        <select
          name="businessType"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            if (e.target.value) setTools(toolsFor(e.target.value));
          }}
          className="field"
        >
          <option value="">Choose…</option>
          {BUSINESS_TYPES.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What you do for them" hint="One or two lines, e.g. “Instagram reels and ads for a bakery, monthly report”.">
        <textarea name="description" rows={2} maxLength={1000} value={brief} onChange={(e) => setBrief(e.target.value)} className="field" />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <legend className="text-[13px] font-medium text-label-2">Tools for this client</legend>
          {aiOn && (
            <button type="button" disabled={busy || brief.trim().length < 3} onClick={suggest} className={buttonClass("plain", "sm")}>
              <Sparkles size={13} /> {busy ? "Thinking…" : "Suggest with AI"}
            </button>
          )}
        </div>
        {CLIENT_TOOLS.map((t) => {
          const on = tools.includes(t.key);
          return (
            <label key={t.key} className={clsx("flex cursor-pointer items-start gap-3 rounded-[16px] px-3 py-2 transition", on ? "bg-accent-soft" : "bg-well")}>
              <input type="checkbox" name="features" value={t.key} checked={on} onChange={() => setTools((all) => (on ? all.filter((x) => x !== t.key) : [...all, t.key]))} className="sr-only" />
              <span className={clsx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-accent bg-accent text-white" : "border-label-3")}>{on && <Check size={11} strokeWidth={3.5} />}</span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium">{t.label}</span>
                <span className="block text-[12px] text-label-2">{t.description}</span>
              </span>
            </label>
          );
        })}
        {note && <p className="px-1 text-[12px] text-label-2">{note}</p>}
      </fieldset>

      {tools.includes("app") && (
        <Field label="App or website name">
          <input name="appName" maxLength={200} defaultValue={client?.appName} className="field" />
        </Field>
      )}
      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-medium text-label-2">Colour</legend>
        <div className="flex flex-wrap gap-2.5">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={(client?.color ?? COLORS[0]).toUpperCase() === c} className="peer sr-only" />
              <span className="block size-8 rounded-full ring-offset-2 ring-offset-elevated peer-checked:ring-2 peer-focus-visible:ring-2" style={{ background: c, ["--tw-ring-color" as string]: c }} />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}
