"use client";
import { useOptimistic, useTransition } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { toggleTask } from "@/app/actions/tasks";

export function TaskCheck({ id, done, label }: { id: number; done: boolean; label: string }) {
  const [optimistic, set] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`Mark "${label}" ${optimistic ? "not done" : "done"}`}
      onClick={() =>
        start(async () => {
          set(!optimistic);
          await toggleTask(id, !optimistic);
        })
      }
      className={clsx(
        "grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-full border-2 transition",
        optimistic ? "border-blue bg-blue text-white" : "border-label-3 hover:border-blue",
      )}
    >
      {optimistic && <Check size={13} strokeWidth={3.5} />}
    </button>
  );
}
