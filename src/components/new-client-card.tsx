"use client";
import { Plus } from "lucide-react";

/** The dashed "New client" card at the end of the client list; opens the same sheet as the header button. */
export function NewClientCard() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("open-sheet", { detail: "new-client" }))}
      className="grid min-h-48 cursor-pointer place-items-center rounded-[22px] p-5 text-center text-label-2 transition hover:bg-fill hover:text-label"
      style={{ outline: "1.5px dashed var(--fill-2)", outlineOffset: "-1.5px" }}
    >
      <span>
        <span className="glass mx-auto mb-2 grid size-10 place-items-center rounded-[12px]">
          <Plus size={18} />
        </span>
        <span className="block text-[15px] font-semibold">New client</span>
        <span className="block text-[12px] text-label-3">Or describe them and Claude sets it up</span>
      </span>
    </button>
  );
}
