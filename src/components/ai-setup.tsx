"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Check, ChevronDown, Sparkles, Wand2 } from "lucide-react";
import { applySetup } from "@/app/actions/setup";
import type { SetupProposal, SetupQuestion } from "@/lib/ai/setup";
import { MODULES } from "@/lib/modules";
import { PageBlocks } from "./custom/blocks";
import { iconFor } from "./custom/icons";
import { LiquidButton, type LiquidState } from "./liquid-button";
import { buttonClass, Field } from "./ui";

type Answer = { picked: string[]; other: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/**
 * The AI setup: "what do you do?" → multiple-choice questions written for that job → a proposal (sections
 * and custom pages, previewed for real) → create. Used at first sign-in and from Settings.
 */
export function AiSetup({
  onboarding = false,
  current,
  name = "",
  today,
  onSkip,
}: {
  onboarding?: boolean;
  current: string[];
  name?: string;
  today: string;
  onSkip?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"who" | "questions" | "proposal">("who");
  const [profession, setProfession] = useState("");
  const [wish, setWish] = useState("");
  const [displayName, setDisplayName] = useState(name);
  const [tz, setTz] = useState("");
  const [questions, setQuestions] = useState<SetupQuestion[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [proposal, setProposal] = useState<SetupProposal | null>(null);
  const [modules, setModules] = useState<string[]>(current);
  const [b2b, setB2b] = useState(false);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [open, setOpen] = useState<number | null>(0);
  const [busy, setBusy] = useState<LiquidState>("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  async function run<T>(fn: () => Promise<T>) {
    setBusy("busy");
    setError(null);
    try {
      const out = await fn();
      setBusy("idle");
      return out;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy("idle");
      return null;
    }
  }

  async function ask() {
    const out = await run(() => post<{ questions: SetupQuestion[] }>("/api/ai/setup/questions", { profession, wish }));
    if (!out) return;
    setQuestions(out.questions);
    setAnswers(out.questions.map(() => ({ picked: [], other: "" })));
    setStep("questions");
  }

  async function propose() {
    const out = await run(() =>
      post<{ proposal: SetupProposal }>("/api/ai/setup/propose", {
        profession,
        wish,
        answers: questions.map((q, i) => ({ question: q.text, picked: answers[i].picked, other: answers[i].other })),
      }),
    );
    if (!out) return;
    setProposal(out.proposal);
    setB2b(out.proposal.business.b2b || (!onboarding && current.includes("clients")));
    // A re-run only adds: sections already on stay on unless unticked.
    setModules(onboarding ? out.proposal.modules : [...new Set([...current, ...out.proposal.modules])]);
    setKeep(out.proposal.pages.map(() => true));
    setOpen(out.proposal.pages.length ? 0 : null);
    setStep("proposal");
  }

  async function create() {
    if (!proposal) return;
    const out = await run(() =>
      applySetup({
        modules,
        pages: proposal.pages.filter((_, i) => keep[i]),
        business: { ...proposal.business, b2b },
        ...(onboarding ? { displayName, timezone: tz } : {}),
      }),
    );
    if (!out) return;
    setBusy("done");
    router.push(out.href);
    router.refresh();
  }

  const pick = (qi: number, option: string) =>
    setAnswers((all) =>
      all.map((a, i) => {
        if (i !== qi) return a;
        const on = a.picked.includes(option);
        return { ...a, picked: questions[qi].multi ? (on ? a.picked.filter((x) => x !== option) : [...a.picked, option]) : on ? [] : [option] };
      }),
    );
  const answered = answers.filter((a) => a.picked.length || a.other.trim()).length;

  return (
    <div className="flex flex-col gap-5">
      {step === "who" && (
        <div className="glass flex flex-col gap-4 rounded-[24px] p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-orange to-pink text-white">
              <Wand2 size={17} />
            </span>
            <div>
              <p className="text-[17px] font-semibold">Set up with AI</p>
              <p className="text-[13px] text-label-2">A few questions, then pages built for your work. Nothing is saved until you confirm.</p>
            </div>
          </div>
          <Field label="What do you do?">
            <input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              maxLength={80}
              placeholder="e.g. wedding photographer, civil engineer, nurse, student"
              className="field text-[17px]"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && profession.trim().length >= 2 && ask()}
            />
          </Field>
          <Field label="Anything specific you want help with? (optional)">
            <input value={wish} onChange={(e) => setWish(e.target.value)} maxLength={400} placeholder="e.g. keep track of bookings and deposits" className="field" />
          </Field>
          {onboarding && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Your name" hint="Used in the Home greeting.">
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="field" />
              </Field>
              <Field label="Time zone">
                <input value={tz} onChange={(e) => setTz(e.target.value)} className="field" />
              </Field>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onSkip && (
              <button type="button" onClick={onSkip} className={clsx(buttonClass("plain"), "mr-auto")}>
                Skip, pick sections myself
              </button>
            )}
            <LiquidButton state={busy} disabled={busy === "busy" || profession.trim().length < 2} onClick={ask} icon={<Sparkles size={15} />} label="Next" busyLabel="Thinking…" doneLabel="Done" />
          </div>
        </div>
      )}

      {step === "questions" && (
        <>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep("who")} className={buttonClass("plain", "sm")}>
              <ArrowLeft size={14} /> Back
            </button>
            <p className="text-[13px] text-label-2">
              {profession} · {answered}/{questions.length} answered
            </p>
          </div>
          {questions.map((q, qi) => (
            <fieldset key={qi} className="glass flex flex-col gap-3 rounded-[24px] p-4">
              <legend className="sr-only">{q.text}</legend>
              <p className="text-[16px] font-semibold">
                {q.text}
                {q.multi && <span className="ml-2 text-[12px] font-normal text-label-2">pick any</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const on = answers[qi]?.picked.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      role={q.multi ? "checkbox" : "radio"}
                      aria-checked={on}
                      onClick={() => pick(qi, o)}
                      className={clsx("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition", on ? "bg-accent text-white" : "bg-fill text-label hover:bg-fill-2")}
                    >
                      {on && <Check size={13} strokeWidth={3} />}
                      {o}
                    </button>
                  );
                })}
              </div>
              <input
                value={answers[qi]?.other ?? ""}
                onChange={(e) => setAnswers((all) => all.map((a, i) => (i === qi ? { ...a, other: e.target.value } : a)))}
                maxLength={200}
                placeholder="Other (optional)"
                aria-label={`Other answer: ${q.text}`}
                className="field h-9 text-[14px]"
              />
            </fieldset>
          ))}
          <div className="flex justify-end">
            <LiquidButton state={busy} disabled={busy === "busy" || answered === 0} onClick={propose} icon={<Wand2 size={15} />} label="Build my pages" busyLabel="Designing your pages…" doneLabel="Done" />
          </div>
        </>
      )}

      {step === "proposal" && proposal && (
        <>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep("questions")} className={buttonClass("plain", "sm")}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          {proposal.summary && <div className="glass rounded-[24px] p-4 text-[15px] leading-relaxed">{proposal.summary}</div>}

          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-semibold text-label-2 uppercase">Your business</h2>
            <label className="glass flex cursor-pointer items-center gap-3 rounded-[24px] px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{proposal.business.kind || profession}</span>
                <span className="block text-[13px] text-label-2">I work for other businesses (clients): adds the Clients section with a dashboard per client.</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={b2b}
                onChange={(e) => {
                  setB2b(e.target.checked);
                  setModules((all) => (e.target.checked ? (all.includes("clients") ? all : [...all, "clients"]) : all.filter((x) => x !== "clients")));
                }}
              />
            </label>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-semibold text-label-2 uppercase">Sections</h2>
            <div className="glass divide-y divide-separator overflow-hidden rounded-[24px]">
              {MODULES.filter((m) => m.key !== "clients" || b2b).map((m) => {
                const on = modules.includes(m.key);
                return (
                  <label key={m.key} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                    <input type="checkbox" checked={on} onChange={() => setModules((all) => (on ? all.filter((x) => x !== m.key) : [...all, m.key]))} className="sr-only" />
                    <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full border-2 transition", on ? "border-ink bg-ink text-on-ink" : "border-separator")}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">
                        {m.label}
                        {proposal.modules.includes(m.key) && <span className="ml-2 text-[12px] font-normal text-accent">suggested</span>}
                      </span>
                      <span className="block text-[13px] text-label-2">{m.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {proposal.pages.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="px-1 text-[13px] font-semibold text-label-2 uppercase">Your new pages</h2>
              {proposal.pages.map((p, i) => {
                const Icon = iconFor(p.icon);
                return (
                  <div key={i} className={clsx("glass flex flex-col gap-3 rounded-[24px] p-4 transition", !keep[i] && "opacity-55")}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: p.color }}>
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold">{p.title}</p>
                        <p className="truncate text-[13px] text-label-2">
                          {p.description || `${p.spec.blocks.length} blocks`} · {p.spec.collections.map((c) => c.name).join(", ")}
                        </p>
                      </div>
                      <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className={buttonClass("gray", "sm")}>
                        Preview <ChevronDown size={13} className={clsx("transition", open === i && "rotate-180")} />
                      </button>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={keep[i] ?? false}
                        aria-label={`Create ${p.title}`}
                        onChange={() => setKeep((k) => k.map((x, j) => (j === i ? !x : x)))}
                        className="switch"
                      />
                    </div>
                    {open === i && (
                      <div className="pointer-events-none rounded-[20px] bg-fill/50 p-3 select-none">
                        <PageBlocks pageId={0} spec={p.spec} items={[]} today={today} preview />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          {proposal.dropped.length > 0 && <p className="px-1 text-[12px] text-label-3">Left out because they didn&apos;t fit the building blocks: {proposal.dropped.slice(0, 3).join("; ")}</p>}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={propose} disabled={busy === "busy"} className={buttonClass("plain")}>
              Try another version
            </button>
            <LiquidButton
              state={busy}
              disabled={busy === "busy" || (keep.every((k) => !k) && !modules.length)}
              onClick={create}
              icon={<Check size={15} />}
              label={onboarding ? "Create my hub" : "Add to my hub"}
              busyLabel="Creating…"
              doneLabel="Done"
            />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-[14px] bg-red/12 px-3 py-2 text-[14px] text-red">
          {error}
        </p>
      )}
    </div>
  );
}
