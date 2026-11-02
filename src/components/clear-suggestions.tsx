"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { clearSuggestions } from "@/app/actions/tasks";
import { buttonClass } from "./ui";

export function ClearSuggestions({ count }: { count: number }) {
  const [pending, start] = useTransition();
  if (!count) return null;
  return (
    <button
      className={buttonClass("gray")}
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete all ${count} suggestion${count === 1 ? "" : "s"}? Blocks you accepted stay.`)) start(() => clearSuggestions());
      }}
    >
      <Trash2 size={15} /> {pending ? "Clearing…" : `Clear ${count} suggestion${count === 1 ? "" : "s"}`}
    </button>
  );
}
