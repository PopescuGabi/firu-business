"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { LiquidButton, type LiquidState } from "./liquid-button";

/** Asks Claude how best to get around this week. Without a key, copies the prompt for the Claude app. */
export function RouteAdvice() {
  const [state, setState] = useState<LiquidState>("idle");
  const [advice, setAdvice] = useState("");
  const [note, setNote] = useState("");

  async function run() {
    setState("busy");
    setNote("");
    try {
      const res = await fetch("/api/ai/route", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Route advice failed");
      if (data.prompt) {
        await navigator.clipboard.writeText(data.prompt);
        window.open("https://claude.ai/new", "_blank", "noopener");
        setNote("Prompt copied. Paste it into Claude (⌘V) for your route advice.");
      } else {
        setAdvice(data.advice);
      }
      setState("done");
      window.setTimeout(() => setState("idle"), 1600);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Route advice failed");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <LiquidButton size="sm" state={state} disabled={state === "busy"} onClick={run} icon={<Sparkles size={14} />} label="Route advice" busyLabel="Thinking…" doneLabel="Done" className="self-start" />
      {note && <p className="text-[13px] text-label-2">{note}</p>}
      {advice && <div className="rounded-[14px] bg-well px-3 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">{advice}</div>}
    </div>
  );
}
