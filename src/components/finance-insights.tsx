"use client";
import { useState } from "react";
import { ClipboardCopy, Sparkles, X } from "lucide-react";
import { LiquidButton, type LiquidState } from "./liquid-button";
import { buttonClass } from "./ui";

/** "What should I watch this month?": Haiku reads your money totals. Without a key, copies the prompt for the Claude app. */
export function FinanceInsights() {
  const [state, setState] = useState<LiquidState>("idle");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  async function run() {
    setState("busy");
    setNote("");
    try {
      const res = await fetch("/api/ai/finance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claude couldn't help this time");
      if (data.prompt) {
        await navigator.clipboard.writeText(data.prompt);
        window.open("https://claude.ai/new", "_blank", "noopener");
        setNote("Prompt copied. Paste it into Claude (⌘V).");
      } else setText(data.text || "Nothing to flag this month.");
      setState("done");
      window.setTimeout(() => setState("idle"), 1600);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  return (
    <>
      <LiquidButton size="sm" state={state} disabled={state === "busy"} onClick={run} icon={<Sparkles size={14} />} label="Insights" busyLabel="Reading…" doneLabel="Done" />
      {note && <p className="text-[13px] text-label-2">{note}</p>}
      {text && (
        <div className="chrome fixed inset-x-3 bottom-24 z-40 max-h-[70dvh] overflow-y-auto rounded-[24px] !bg-[var(--bg-elevated)] p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(520px,calc(100vw-48px))]">
          <div className="mb-2 flex items-center gap-2">
            <p className="flex-1 text-[15px] font-semibold">What to watch this month</p>
            <button type="button" className={buttonClass("gray", "sm")} onClick={() => navigator.clipboard.writeText(text)}>
              <ClipboardCopy size={13} /> Copy
            </button>
            <button type="button" aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-label-2 hover:bg-fill" onClick={() => setText("")}>
              <X size={16} />
            </button>
          </div>
          <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{text}</div>
        </div>
      )}
    </>
  );
}
