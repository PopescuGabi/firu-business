"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCopy, FileText, Lightbulb, Mail, X } from "lucide-react";
import { LiquidButton, type LiquidState } from "./liquid-button";
import { buttonClass } from "./ui";

type Mode = "report" | "ideas" | "plan" | "summary";
const MODES: { key: Mode; label: string; busy: string; icon: React.ReactNode; clientOnly?: boolean }[] = [
  { key: "report", label: "Weekly report", busy: "Reading…", icon: <FileText size={14} /> },
  { key: "ideas", label: "Ideas & hooks", busy: "Thinking…", icon: <Lightbulb size={14} /> },
  { key: "plan", label: "Posting plan", busy: "Planning…", icon: <CalendarPlus size={14} /> },
  { key: "summary", label: "Client summary", busy: "Writing…", icon: <Mail size={14} />, clientOnly: true },
];

/** Claude's marketing help: a weekly report, ideas and hooks, a posting plan (into Calendar), a client update. */
export function MarketingAi({ clientId, hasPosts }: { clientId?: number; hasPosts: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Partial<Record<Mode, LiquidState>>>({});
  const [result, setResult] = useState<{ mode: Mode; text: string } | null>(null);
  const [note, setNote] = useState("");
  if (!hasPosts) return null;

  async function run(mode: Mode) {
    setState((s) => ({ ...s, [mode]: "busy" }));
    setNote("");
    try {
      const res = await fetch("/api/ai/marketing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, clientId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claude couldn't help this time");
      if (data.prompt) {
        await navigator.clipboard.writeText(data.prompt);
        window.open("https://claude.ai/new", "_blank", "noopener");
        setNote("Prompt copied. Paste it into Claude (⌘V).");
      } else {
        setResult({ mode, text: data.text || "No suggestions this time." });
        if (mode === "plan" && data.added) {
          setNote(`${data.added} posting suggestion${data.added === 1 ? "" : "s"} added to your Calendar. Accept the ones you want.`);
          router.refresh();
        }
      }
      setState((s) => ({ ...s, [mode]: "done" }));
      window.setTimeout(() => setState((s) => ({ ...s, [mode]: "idle" })), 1600);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong");
      setState((s) => ({ ...s, [mode]: "idle" }));
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {MODES.filter((m) => !m.clientOnly || clientId).map((m) => (
          <LiquidButton key={m.key} size="sm" state={state[m.key] ?? "idle"} disabled={state[m.key] === "busy"} onClick={() => run(m.key)} icon={m.icon} label={m.label} busyLabel={m.busy} doneLabel="Done" />
        ))}
      </div>
      {note && <p className="max-w-md text-right text-[13px] text-label-2">{note}</p>}
      {result && (
        <div className="chrome fixed inset-x-3 bottom-24 z-40 max-h-[70dvh] overflow-y-auto rounded-[24px] !bg-[var(--bg-elevated)] p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(560px,calc(100vw-48px))]">
          <div className="mb-2 flex items-center gap-2">
            <p className="flex-1 text-[15px] font-semibold">{MODES.find((m) => m.key === result.mode)?.label}</p>
            <button type="button" className={buttonClass("gray", "sm")} onClick={() => navigator.clipboard.writeText(result.text)}>
              <ClipboardCopy size={13} /> Copy
            </button>
            <button type="button" aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-label-2 hover:bg-fill" onClick={() => setResult(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{result.text}</div>
        </div>
      )}
    </div>
  );
}
