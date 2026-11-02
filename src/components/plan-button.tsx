"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { buttonClass } from "./ui";

export function PlanButton({ claudeConfigured, label = "Plan my week" }: { claudeConfigured: boolean; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  async function run(mode: "ai" | "basic") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planning failed");
      setMsg(
        data.created
          ? `${data.created} suggestion${data.created === 1 ? "" : "s"} added. Accept the ones you want.`
          : "No free time left to plan.",
      );
      start(() => router.refresh());
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Planning failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {!claudeConfigured && (
          <button className={buttonClass("gray")} disabled={busy} onClick={() => run("basic")}>
            Basic plan
          </button>
        )}
        <button
          className={buttonClass("filled")}
          disabled={busy || !claudeConfigured}
          title={claudeConfigured ? undefined : "Add your Anthropic API key to use AI planning"}
          onClick={() => run("ai")}
        >
          <Sparkles size={16} className={busy ? "animate-pulse" : ""} />
          {busy ? "Planning…" : label}
        </button>
      </div>
      {msg && (
        <p role="status" className="max-w-xs text-right text-[12px] text-label-2">
          {msg}
        </p>
      )}
    </div>
  );
}
