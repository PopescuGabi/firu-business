"use client";
import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { acceptBlock, removeBlock } from "@/app/actions/tasks";

export function BlockActions({ id, accepted }: { id: number; accepted: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {!accepted && (
        <button
          aria-label="Accept and add to calendar"
          disabled={pending}
          onClick={() => start(() => acceptBlock(id))}
          className="grid size-7 cursor-pointer place-items-center rounded-full bg-green text-white disabled:opacity-50"
        >
          <Check size={15} strokeWidth={3} />
        </button>
      )}
      <button
        aria-label={accepted ? "Remove from plan and calendar" : "Dismiss suggestion"}
        disabled={pending}
        onClick={() => start(() => removeBlock(id))}
        className="grid size-7 cursor-pointer place-items-center rounded-full bg-fill text-label-2 hover:bg-fill-2 disabled:opacity-50"
      >
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
