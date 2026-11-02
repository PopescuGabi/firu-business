"use client";
import { useOptimistic, useTransition } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { setFeedbackDone } from "@/app/actions/feedback";

export function FeedbackCheck({ id, done, label }: { id: number; done: boolean; label: string }) {
  const [optimistic, set] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`Mark feedback "${label}" ${optimistic ? "not handled" : "handled"}`}
      onClick={() =>
        start(async () => {
          set(!optimistic);
          await setFeedbackDone(id, !optimistic);
        })
      }
      className={clsx(
        "mt-0.5 grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full border-2 transition",
        optimistic ? "border-green bg-green text-white" : "border-label-3 hover:border-green",
      )}
    >
      {optimistic && <Check size={13} strokeWidth={3.5} />}
    </button>
  );
}
