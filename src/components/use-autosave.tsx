"use client";
import { useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "saving" | "unsaved" | "error";

/** Saves `value` shortly after it stops changing. Call `reset` after loading data from the server. */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, delay = 900) {
  const [state, setState] = useState<SaveState>("saved");
  const last = useRef(JSON.stringify(value));
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const json = JSON.stringify(value);
    if (json === last.current) return;
    setState("unsaved");
    const t = setTimeout(async () => {
      setState("saving");
      try {
        await saveRef.current(value);
        last.current = json;
        setState("saved");
      } catch {
        setState("error");
      }
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (state === "saved") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

  return {
    state,
    reset: (v: T) => {
      last.current = JSON.stringify(v);
      setState("saved");
    },
  };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const text = { saved: "Saved", saving: "Saving…", unsaved: "Editing…", error: "Couldn't save. Retrying when you edit." }[state];
  return (
    <span role="status" className={state === "error" ? "text-[13px] text-red" : "text-[13px] text-label-2"}>
      {text}
    </span>
  );
}
