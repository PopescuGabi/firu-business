"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, Brain, ClipboardCopy, ListChecks, Target } from "lucide-react";
import { saveReelPlan } from "@/app/actions/clients";
import { REVIEW } from "@/lib/reels-brain/content";
import {
  AWARENESS,
  AWARENESS_LABELS,
  CAPTION_LABELS,
  CAPTION_STYLES,
  OBJECTIVE_LABELS,
  OBJECTIVES,
  TREATMENT_LABELS,
  TREATMENTS,
  reelPlan,
  type ReelPlan,
} from "@/lib/reels-brain/types";
import { LiquidButton, type LiquidState } from "./liquid-button";
import { buttonClass, Card, Field, Pill } from "./ui";
import { SaveIndicator, useAutosave } from "./use-autosave";

type Review = {
  verdict: string;
  findings: { area: string; severity: "high" | "medium" | "low"; issue: string; fix: string }[];
  hooks: { visual: string; text: string; spoken: string; why: string }[];
  captionPlan: { style: "phrase" | "highlight" | "karaoke" | "none"; why: string; emphasis: string[] };
};
const SEVERITY: Record<string, string> = { high: "var(--red)", medium: "var(--orange)", low: "var(--label-2)" };

function Select<T extends string>({ value, options, labels, onChange, label }: { value: T; options: readonly T[]; labels: Record<string, string>; onChange: (v: T) => void; label: string }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="field">
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Reels Brain on a reel: the plan (diagnosis → caption plan → one experiment) and the review checklist + Brain review. */
export function ReelBrain({ reelId, initialPlan }: { reelId: number; initialPlan: unknown }) {
  const [plan, setPlan] = useState<ReelPlan>(() => reelPlan.parse(initialPlan ?? {}));
  const { state } = useAutosave(plan, (p) => saveReelPlan(reelId, p));
  const set = <K extends keyof ReelPlan>(k: K, v: ReelPlan[K]) => setPlan((p) => ({ ...p, [k]: v }));
  const [tab, setTab] = useState<"plan" | "review">("plan");
  const [busy, setBusy] = useState<LiquidState>("idle");
  const [review, setReview] = useState<Review | null>(null);
  const [note, setNote] = useState("");

  const total = REVIEW.reduce((n, g) => n + g.items.length, 0);
  const done = REVIEW.reduce((n, g) => n + g.items.filter((i) => plan.checks[i.id]).length, 0);

  async function runReview() {
    setBusy("busy");
    setNote("");
    try {
      const res = await fetch("/api/ai/brain-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reelId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claude couldn't review this time");
      if (data.prompt) {
        await navigator.clipboard.writeText(data.prompt);
        window.open("https://claude.ai/new", "_blank", "noopener");
        setNote("Review prompt copied (rules + client profile + this reel). Paste it into Claude (⌘V).");
      } else {
        setReview(data.review);
      }
      setBusy("done");
      window.setTimeout(() => setBusy("idle"), 1600);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong");
      setBusy("idle");
    }
  }

  function useCaptionPlan(c: Review["captionPlan"]) {
    setPlan((p) => ({ ...p, captionStyle: c.style, captionWhy: c.why, emphasis: c.emphasis.join(", ") }));
    setTab("plan");
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Brain size={18} className="text-accent" />
        <p className="flex-1 text-[17px] font-semibold">Reels Brain</p>
        <SaveIndicator state={state} />
        <Link href="/clients?view=brain" className={buttonClass("plain", "sm")}>
          <BookOpen size={13} /> Rules
        </Link>
      </div>
      <div role="tablist" aria-label="Reels Brain" className="mb-4 inline-flex rounded-full bg-fill p-1">
        {(
          [
            ["plan", "Plan", <Target key="p" size={13} />],
            ["review", `Review ${done}/${total}`, <ListChecks key="r" size={13} />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors"
            style={tab === k ? { background: "var(--card-solid)", color: "var(--label)", fontWeight: 600 } : { color: "var(--label-2)" }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === "plan" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Objective" value={plan.objective} options={OBJECTIVES} labels={OBJECTIVE_LABELS} onChange={(v) => set("objective", v)} />
            <Select label="Audience awareness" value={plan.awareness} options={AWARENESS} labels={AWARENESS_LABELS} onChange={(v) => set("awareness", v)} />
            <Select label="Treatment" value={plan.treatment} options={TREATMENTS} labels={TREATMENT_LABELS} onChange={(v) => set("treatment", v)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Promise" hint="What the hook promises (one benefit).">
              <textarea value={plan.promise} onChange={(e) => set("promise", e.target.value)} rows={2} className="field" />
            </Field>
            <Field label="Payoff" hint="What they get, and where (timestamp).">
              <textarea value={plan.payoff} onChange={(e) => set("payoff", e.target.value)} rows={2} className="field" />
            </Field>
            <Field label="Proof" hint="Real only: demo, credentials, case with consent.">
              <textarea value={plan.proof} onChange={(e) => set("proof", e.target.value)} rows={2} className="field" />
            </Field>
            <Field label="CTA + mechanism" hint="One step, after the payoff. How does it work?">
              <textarea value={plan.cta} onChange={(e) => set("cta", e.target.value)} rows={2} className="field" />
            </Field>
          </div>
          <div className="rounded-2xl bg-fill p-3">
            <p className="mb-2 px-1 text-[13px] font-semibold">Caption plan for this video</p>
            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <Select label="Style" value={plan.captionStyle} options={CAPTION_STYLES} labels={CAPTION_LABELS} onChange={(v) => set("captionStyle", v)} />
              <Field label="Why this style">
                <input value={plan.captionWhy} onChange={(e) => set("captionWhy", e.target.value)} className="field" placeholder="e.g. calm doctor at 3 words/s → phrase chunks, no word pops" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Emphasis words" hint="Words that carry the argument; max one accent per chunk.">
                <input value={plan.emphasis} onChange={(e) => set("emphasis", e.target.value)} className="field" placeholder="oameni, grijă, tine" />
              </Field>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Motion plan" hint="Keyword → visual change; where to hold still.">
              <textarea value={plan.motion} onChange={(e) => set("motion", e.target.value)} rows={3} className="field" />
            </Field>
            <Field label="Audio plan" hint="Voice fixes, music level/licence, SFX, −14 LUFS.">
              <textarea value={plan.audio} onChange={(e) => set("audio", e.target.value)} rows={3} className="field" />
            </Field>
          </div>
          <div className="rounded-2xl bg-fill p-3">
            <p className="mb-2 px-1 text-[13px] font-semibold">One experiment</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px]">
              <Field label="Hypothesis">
                <input value={plan.hypothesis} onChange={(e) => set("hypothesis", e.target.value)} className="field" placeholder="Opening on the benefit line lowers Skip Rate" />
              </Field>
              <Field label="Changed variable">
                <input value={plan.variable} onChange={(e) => set("variable", e.target.value)} className="field" placeholder="First 3 s only" />
              </Field>
              <Field label="Metric">
                <input value={plan.metric} onChange={(e) => set("metric", e.target.value)} className="field" placeholder="Skip Rate, 48 h" />
              </Field>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <LiquidButton size="sm" state={busy} disabled={busy === "busy"} onClick={runReview} icon={<Brain size={14} />} label="Brain review" busyLabel="Reviewing…" doneLabel="Done" />
            <p className="text-[13px] text-label-2">Opus checks the hook, story, CTA and captions against the rules, the client profile and this plan.</p>
          </div>
          {note && <p className="text-[13px] text-label-2">{note}</p>}
          {review && (
            <div className="space-y-3 rounded-2xl bg-fill p-3">
              <p className="text-[14px] font-medium">{review.verdict}</p>
              {review.findings.length > 0 && (
                <ul className="space-y-2">
                  {review.findings.map((f, i) => (
                    <li key={i} className="rounded-xl bg-card-solid p-3 text-[14px]">
                      <div className="mb-1 flex items-center gap-2">
                        <Pill color={SEVERITY[f.severity]}>{f.severity}</Pill>
                        <span className="text-[12px] font-semibold uppercase tracking-wide text-label-2">{f.area}</span>
                      </div>
                      <p>{f.issue}</p>
                      <p className="mt-1 text-label-2">→ {f.fix}</p>
                    </li>
                  ))}
                </ul>
              )}
              {review.hooks.length > 0 && (
                <div>
                  <p className="mb-1 text-[13px] font-semibold">Hook options</p>
                  <ul className="space-y-2">
                    {review.hooks.map((h, i) => (
                      <li key={i} className="rounded-xl bg-card-solid p-3 text-[14px]">
                        <p>
                          <span className="text-label-2">Frame 0:</span> {h.visual}
                        </p>
                        <p>
                          <span className="text-label-2">Text:</span> {h.text}
                        </p>
                        <p>
                          <span className="text-label-2">Spoken:</span> {h.spoken}
                        </p>
                        <p className="mt-1 text-[13px] text-label-2">{h.why}</p>
                        <button type="button" className={buttonClass("gray", "sm") + " mt-2"} onClick={() => navigator.clipboard.writeText(`${h.text}\n${h.spoken}`)}>
                          <ClipboardCopy size={12} /> Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-xl bg-card-solid p-3 text-[14px]">
                <p className="text-[13px] font-semibold">Suggested caption plan</p>
                <p>
                  {CAPTION_LABELS[review.captionPlan.style]} — {review.captionPlan.why}
                </p>
                {review.captionPlan.emphasis.length > 0 && <p className="text-label-2">Emphasis: {review.captionPlan.emphasis.join(", ")}</p>}
                <button type="button" className={buttonClass("tinted", "sm") + " mt-2"} onClick={() => useCaptionPlan(review.captionPlan)}>
                  Use in plan
                </button>
              </div>
            </div>
          )}
          {REVIEW.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 px-1 text-[13px] font-semibold text-label-2">{g.title}</p>
              <div className="space-y-1">
                {g.items.map((i) => (
                  <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-fill">
                    <input
                      type="checkbox"
                      checked={Boolean(plan.checks[i.id])}
                      onChange={(e) => set("checks", { ...plan.checks, [i.id]: e.target.checked })}
                      className="mt-0.5 size-4 accent-[var(--accent)]"
                    />
                    <span className="text-[14px]">{i.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
