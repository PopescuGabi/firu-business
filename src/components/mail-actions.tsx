"use client";
import { useActionState, useEffect, useState } from "react";
import { ListTodo, Send, Sparkles } from "lucide-react";
import { mailToTask, replyToMail, type MailState } from "@/app/actions/email";
import { LiquidButton } from "./liquid-button";
import { buttonClass, Field } from "./ui";

/** Reply in the same thread. Nothing is sent until you press Send; AI only summarises or fills the box. */
export function ReplyForm({ id, to, ai = false }: { id: string; to: string; ai?: boolean }) {
  const [state, send, sending] = useActionState<MailState, FormData>(replyToMail.bind(null, id), null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState<"summary" | "reply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (state?.ok) setText("");
  }, [state]);

  async function ask(mode: "summary" | "reply") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, mode, note: mode === "reply" && note.trim() ? note.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claude couldn't help with this one");
      if (mode === "summary") setSummary(data.text);
      else setText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {ai && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => ask("summary")} disabled={busy !== null} className={buttonClass("gray", "sm")}>
              <Sparkles size={13} /> {busy === "summary" ? "Reading…" : "Summarise"}
            </button>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="What to say (optional)"
              aria-label="What the reply should say"
              className="field h-7 min-w-0 flex-1 py-0 text-[13px]"
            />
            <button type="button" onClick={() => ask("reply")} disabled={busy !== null} className={buttonClass("tinted", "sm")}>
              <Sparkles size={13} /> {busy === "reply" ? "Writing…" : "Draft reply"}
            </button>
          </div>
          {summary && <div className="rounded-[14px] bg-well px-3 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">{summary}</div>}
          {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
        </div>
      )}
      <form action={send} className="flex flex-col gap-2">
        <Field label={`Reply to ${to}`} hint={ai ? "Haiku can draft it; check it before you press Send." : undefined}>
          <textarea name="text" required rows={5} maxLength={20_000} value={text} onChange={(e) => setText(e.target.value)} className="field" />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {state && <span className={state.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{state.message}</span>}
          <LiquidButton disabled={sending} state={sending ? "busy" : state?.ok ? "done" : "idle"} label="Send" busyLabel="Sending…" doneLabel="Sent" chip icon={<Send size={15} />} />
        </div>
      </form>
    </div>
  );
}

/** Turn the email into a task (title from the subject, a link back to the thread). */
export function MailToTask({ id, subject, compact }: { id: string; subject: string; compact?: boolean }) {
  const [state, make, making] = useActionState<MailState, FormData>(mailToTask.bind(null, id), null);
  if (compact) {
    return (
      <form action={make}>
        <LiquidButton
          square
          size="sm"
          className="!h-8"
          aria-label={`Make a task from “${subject}”`}
          title={state?.message ?? "Make a task"}
          disabled={making || state?.ok}
          state={making ? "busy" : state?.ok ? "done" : "idle"}
          icon={<ListTodo size={15} />}
          label=""
        />
      </form>
    );
  }
  return (
    <form action={make} className="flex flex-wrap items-end gap-2">
      <Field label="Task">
        <input name="title" defaultValue={subject} maxLength={200} className="field" />
      </Field>
      <Field label="Due">
        <input type="date" name="due" className="field" />
      </Field>
      <button className={buttonClass("tinted")} disabled={making || state?.ok}>
        <ListTodo size={15} /> {state?.ok ? "Task added" : making ? "Adding…" : "Make task"}
      </button>
      {state && !state.ok && <span className="text-[13px] text-red">{state.message}</span>}
    </form>
  );
}
