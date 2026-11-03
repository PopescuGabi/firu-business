"use client";
import { useActionState, useEffect, useRef } from "react";
import { ListTodo, Send } from "lucide-react";
import { mailToTask, replyToMail, type MailState } from "@/app/actions/email";
import { LiquidButton } from "./liquid-button";
import { buttonClass, Field } from "./ui";

/** Reply in the same thread. Nothing is sent until you press Send. */
export function ReplyForm({ id, to }: { id: string; to: string }) {
  const [state, send, sending] = useActionState<MailState, FormData>(replyToMail.bind(null, id), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={send} className="flex flex-col gap-2">
      <Field label={`Reply to ${to}`}>
        <textarea name="text" required rows={5} maxLength={20_000} className="field" />
      </Field>
      <div className="flex items-center justify-end gap-3">
        {state && <span className={state.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{state.message}</span>}
        <LiquidButton disabled={sending} state={sending ? "busy" : state?.ok ? "done" : "idle"} label="Send" busyLabel="Sending…" doneLabel="Sent" chip icon={<Send size={15} />} />
      </div>
    </form>
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
