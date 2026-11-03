"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ArrowUp, Check, ClipboardPaste, Copy, RotateCcw, Sparkles } from "lucide-react";
import { applyProposal, clearChat } from "@/app/actions/clients";
import { importClaudeReply, prepareClaudePrompt } from "@/app/actions/claude-app";
import { buttonClass } from "./ui";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  proposal: unknown;
  applied: boolean;
};

export function ClaudePanel<T>({
  targetType,
  targetId,
  initialMessages,
  prompts,
  claudeConfigured,
  renderProposal,
  onApplied,
  suggestions,
}: {
  targetType: "reel" | "carousel";
  targetId: number;
  initialMessages: ChatMessage[];
  prompts: { id: number; name: string; category: string }[];
  claudeConfigured: boolean;
  renderProposal: (proposal: unknown) => ReactNode;
  onApplied: (record: T) => void;
  suggestions: string[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const relevant = prompts.filter((p) => p.category === targetType || p.category === "general");
  const [selected, setSelected] = useState<number[]>(relevant.map((p) => p.id));
  // "app" = copy a prompt into the Claude app (covered by a Claude subscription); "api" = Opus runs inside the site.
  const [mode, setMode] = useState<"app" | "api">(claudeConfigured ? "api" : "app");
  const [request, setRequest] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming !== null) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: -Date.now(), role: "user", content: message, proposal: null, applied: false }]);
    setStreaming("");
    try {
      const res = await fetch("/api/ai/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, message, promptIds: selected }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") {
            acc += ev.text;
            setStreaming(acc);
          } else if (ev.type === "done") {
            setMessages((m) => [...m, { id: ev.id, role: "assistant", content: ev.content, proposal: ev.proposal, applied: false }]);
          } else if (ev.type === "error") {
            setError(ev.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStreaming(null);
    }
  }

  async function apply(id: number) {
    setApplying(id);
    setError(null);
    try {
      const record = (await applyProposal(id)) as T;
      onApplied(record);
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, applied: true } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply");
    } finally {
      setApplying(null);
    }
  }

  return (
    <section aria-label="Claude editor" className="glass flex h-full min-h-[520px] flex-col overflow-hidden rounded-[24px]">
      <header className="flex items-center gap-2 border-b border-separator px-4 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-orange to-pink text-white">
          <Sparkles size={15} />
        </span>
        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-tight">Opus 5.5</p>
          <div role="radiogroup" aria-label="Where Claude runs" className="mt-1 inline-flex rounded-[8px] bg-fill p-0.5 text-[11px] font-medium">
            {(
              [
                ["app", "Claude app"],
                ["api", "In this site"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                disabled={m === "api" && !claudeConfigured}
                title={m === "api" && !claudeConfigured ? "Needs an Anthropic API key" : undefined}
                onClick={() => setMode(m)}
                className={clsx(
                  "h-5 cursor-pointer rounded-[6px] px-2 disabled:cursor-not-allowed disabled:opacity-40",
                  mode === m ? "bg-segment shadow-apple" : "text-label-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            className={buttonClass("plain", "sm")}
            onClick={async () => {
              if (!confirm("Clear this conversation?")) return;
              await clearChat(targetType, targetId);
              setMessages([]);
            }}
          >
            <RotateCcw size={13} /> Clear
          </button>
        )}
      </header>

      <div className="border-b border-separator px-4 py-2.5">
        {relevant.length ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Prompts to use">
            {relevant.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  aria-pressed={on}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={clsx(
                    "h-7 cursor-pointer rounded-full px-3 text-[12px] font-medium transition",
                    on ? "bg-blue text-white" : "bg-fill text-label-2 hover:bg-fill-2",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-label-2">
            No saved prompts yet. <Link href="/prompts" className="font-semibold text-blue">Add your prompts</Link> so Opus edits in your style.
          </p>
        )}
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && streaming === null && (
          <div className="pt-6 text-center">
            <p className="text-[15px] font-semibold">Ask for an edit</p>
            <p className="mt-1 text-[13px] text-label-2">
              {mode === "api"
                ? "Opus proposes changes and you apply them with one tap."
                : "Copy a prompt into the Claude app (your Claude subscription), paste the reply back, then apply it with one tap."}
            </p>
            <div className="mt-4 flex flex-col items-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => (mode === "api" ? send(s) : setRequest(s))} className={buttonClass("gray", "sm")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={clsx("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            {m.content && (
              <div
                className={clsx(
                  "max-w-[88%] rounded-[18px] px-3.5 py-2 text-[14px] whitespace-pre-wrap",
                  m.role === "user" ? "rounded-br-md bg-blue text-white" : "rounded-bl-md bg-fill",
                )}
              >
                {m.content}
              </div>
            )}
            {m.proposal != null && (
              <div className="mt-2 w-full rounded-xl border border-separator p-3">
                <p className="mb-2 text-[12px] font-semibold text-label-2 uppercase">Proposed changes</p>
                <div className="space-y-2 text-[13px]">{renderProposal(m.proposal)}</div>
                <button
                  className={clsx(buttonClass(m.applied ? "gray" : "filled", "sm"), "mt-3 w-full")}
                  disabled={m.applied || applying !== null}
                  onClick={() => apply(m.id)}
                >
                  {m.applied ? (
                    <>
                      <Check size={14} /> Applied
                    </>
                  ) : applying === m.id ? (
                    "Applying…"
                  ) : (
                    "Apply changes"
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
        {streaming !== null && (
          <div className="flex">
            <div className="max-w-[88%] rounded-[18px] rounded-bl-md bg-fill px-3.5 py-2 text-[14px] whitespace-pre-wrap">
              {streaming || <span className="inline-flex gap-1 py-1"><Dot /><Dot d="150ms" /><Dot d="300ms" /></span>}
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-red/12 px-3 py-2 text-[13px] text-red">{error}</p>}
      </div>

      {mode === "app" ? (
        <ClaudeAppComposer
          targetType={targetType}
          targetId={targetId}
          promptIds={selected}
          request={request}
          setRequest={setRequest}
          onMessage={(m) => setMessages((list) => [...list, m])}
          onError={setError}
        />
      ) : (
        <form
          className="border-t border-separator p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-[20px] bg-fill py-1.5 pr-1.5 pl-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={claudeConfigured ? "Ask Opus to edit…" : "Claude isn't connected"}
              disabled={!claudeConfigured}
              aria-label="Message to Opus"
              className="max-h-40 min-h-7 flex-1 resize-none bg-transparent py-1 text-[15px] outline-none [field-sizing:content] placeholder:text-label-3"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || streaming !== null || !claudeConfigured}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-blue text-white disabled:bg-fill-2 disabled:text-label-3"
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Dot({ d = "0ms" }: { d?: string }) {
  return <span className="size-1.5 animate-bounce rounded-full bg-label-2" style={{ animationDelay: d }} />;
}

/** Two steps: copy a ready prompt into the Claude app, then paste its reply back here. */
function ClaudeAppComposer({
  targetType,
  targetId,
  promptIds,
  request,
  setRequest,
  onMessage,
  onError,
}: {
  targetType: "reel" | "carousel";
  targetId: number;
  promptIds: number[];
  request: string;
  setRequest: (v: string) => void;
  onMessage: (m: ChatMessage) => void;
  onError: (e: string | null) => void;
}) {
  const [step, setStep] = useState<"ask" | "paste">("ask");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<{ text: string; copied: boolean | null } | null>(null);

  function copyAndOpen() {
    if (!request.trim()) return;
    onError(null);
    setBusy(true);
    const prepared = prepareClaudePrompt({ targetType, targetId, promptIds, request });
    // Write to the clipboard inside the click (Safari requires it), with the text arriving a moment later.
    const blob = prepared.then(({ text }) => new Blob([text], { type: "text/plain" }));
    const copied = (
      typeof ClipboardItem !== "undefined"
        ? navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })])
        : prepared.then(({ text }) => navigator.clipboard.writeText(text))
    ).then(
      () => true,
      () => false,
    );
    window.open("https://claude.ai/new", "_blank", "noopener");
    prepared
      .then(({ message, text }) => {
        onMessage(message);
        setRequest("");
        setPrompt({ text, copied: null });
        setStep("paste");
        return copied.then((ok) => setPrompt({ text, copied: ok }));
      })
      .catch((err) => onError(err instanceof Error ? err.message : "Couldn't prepare the prompt"))
      .finally(() => setBusy(false));
  }

  async function readReply() {
    if (!reply.trim()) return;
    onError(null);
    setBusy(true);
    try {
      const res = await importClaudeReply({ targetType, targetId, reply });
      if ("error" in res && res.error) return onError(res.error);
      if (res.message) onMessage(res.message);
      setReply("");
      setStep("ask");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't read the reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-separator p-3">
      <ol className="flex gap-1 text-[11px] font-semibold" aria-label="Steps">
        {(
          [
            ["ask", "1 · Ask"],
            ["paste", "2 · Paste reply"],
          ] as const
        ).map(([k, label]) => (
          <li key={k}>
            <button
              onClick={() => setStep(k)}
              aria-current={step === k ? "step" : undefined}
              className={clsx("cursor-pointer rounded-full px-2.5 py-1", step === k ? "bg-blue/15 text-blue" : "text-label-2 hover:bg-fill")}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>
      {step === "ask" ? (
        <>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={2}
            placeholder="What should Claude change?"
            aria-label="What should Claude change?"
            className="field max-h-40 [field-sizing:content]"
          />
          <button className={clsx(buttonClass("filled", "sm"), "w-full")} disabled={!request.trim() || busy} onClick={copyAndOpen}>
            <Copy size={14} /> {busy ? "Copying…" : "Copy prompt & open Claude"}
          </button>
          <p className="text-[11px] text-label-2">In Claude, pick Opus 5.5, paste (⌘V) and send. Then copy its whole reply.</p>
        </>
      ) : (
        <>
          {prompt?.copied === true && <p className="text-[12px] text-green">Prompt copied. Paste it in Claude, then paste the reply below.</p>}
          {prompt?.copied === false && (
            <div>
              <p className="mb-1 text-[12px] text-orange">Your browser blocked copying. Select this prompt (⌘A) and copy it (⌘C):</p>
              <textarea readOnly value={prompt.text} rows={3} aria-label="Prompt for Claude" onFocus={(e) => e.currentTarget.select()} className="field font-mono text-[11px]" />
            </div>
          )}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Paste Claude's whole reply here"
            aria-label="Claude's reply"
            className="field max-h-48 font-mono text-[12px]"
          />
          <button className={clsx(buttonClass("filled", "sm"), "w-full")} disabled={!reply.trim() || busy} onClick={readReply}>
            <ClipboardPaste size={14} /> {busy ? "Reading…" : "Read reply"}
          </button>
        </>
      )}
    </div>
  );
}
