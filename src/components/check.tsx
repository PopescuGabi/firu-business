"use client";
import { useOptimistic, useTransition } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { setFeedbackDone } from "@/app/actions/feedback";
import { toggleTask } from "@/app/actions/tasks";

/** Round iOS-style checkbox that flips straight away and saves in the background. */
function RoundCheck({
  done,
  label,
  onToggle,
  className,
  on,
  off,
}: {
  done: boolean;
  label: (done: boolean) => string;
  onToggle: (done: boolean) => Promise<void>;
  className?: string;
  on: string;
  off: string;
}) {
  const [optimistic, set] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label(optimistic)}
      onClick={() =>
        start(async () => {
          set(!optimistic);
          await onToggle(!optimistic);
        })
      }
      className={clsx("grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full border-2 transition", className, optimistic ? on : off)}
    >
      {optimistic && <Check size={13} strokeWidth={3.5} />}
    </button>
  );
}

export function TaskCheck({ id, done, label }: { id: number; done: boolean; label: string }) {
  return (
    <RoundCheck
      done={done}
      label={(d) => `Mark "${label}" ${d ? "not done" : "done"}`}
      onToggle={(d) => toggleTask(id, d)}
      on="border-blue bg-blue text-white"
      off="border-label-3 hover:border-blue"
    />
  );
}

export function FeedbackCheck({ id, done, label }: { id: number; done: boolean; label: string }) {
  return (
    <RoundCheck
      done={done}
      label={(d) => `Mark feedback "${label}" ${d ? "not handled" : "handled"}`}
      onToggle={(d) => setFeedbackDone(id, d)}
      className="mt-0.5"
      on="border-green bg-green text-white"
      off="border-label-3 hover:border-green"
    />
  );
}
