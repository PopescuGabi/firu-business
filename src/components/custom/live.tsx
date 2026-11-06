"use client";
import { useOptimistic, useState, useTransition } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { saveNote, setItemField } from "@/app/actions/custom-pages";
import { SaveIndicator, useAutosave } from "../use-autosave";

/** A checklist row: ticks straight away, saves in the background. */
export function CheckRow({ itemId, field, done, label }: { itemId: number; field: string; done: boolean; label: string }) {
  const [on, setOn] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={() =>
        start(async () => {
          setOn(!on);
          await setItemField(itemId, field, !on);
        })
      }
      className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2 py-1.5 text-left hover:bg-fill"
    >
      <span className={clsx("grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition", on ? "border-accent bg-accent text-white" : "border-label-3")}>
        {on && <Check size={13} strokeWidth={3.5} />}
      </span>
      <span className={clsx("text-[15px]", on && "text-label-3 line-through")}>{label}</span>
    </button>
  );
}

/** The notes block: saves as you type. */
export function NotesBox({ pageId, blockId, initial }: { pageId: number; blockId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const { state } = useAutosave(text, (t) => saveNote(pageId, blockId, t));
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={20_000}
        placeholder="Write anything…"
        aria-label="Notes"
        className="field min-h-36 resize-y [field-sizing:content]"
      />
      <div className="self-end">
        <SaveIndicator state={state} />
      </div>
    </div>
  );
}
