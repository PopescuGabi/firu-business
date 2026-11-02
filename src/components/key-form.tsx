"use client";
import { useActionState } from "react";
import { Check, KeyRound } from "lucide-react";
import { saveLocalKey, type KeyFormState } from "@/app/actions/settings";
import { buttonClass } from "./ui";

export function KeyForm({ name, label, prefix, isSet }: { name: string; label: string; prefix: string; isSet: boolean }) {
  const [state, action, pending] = useActionState<KeyFormState, FormData>(saveLocalKey, null);
  const saved = state?.ok || (isSet && !state);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="key" value={name} />
      <div className="flex items-center justify-between px-1">
        <label htmlFor={name} className="flex items-center gap-1.5 text-[13px] font-medium text-label-2">
          <KeyRound size={13} /> {label}
        </label>
        <span className={saved ? "flex items-center gap-1 text-[12px] font-semibold text-green" : "text-[12px] text-label-2"}>
          {saved ? (
            <>
              <Check size={13} strokeWidth={3} /> Saved
            </>
          ) : (
            "Not set"
          )}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          id={name}
          name="value"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={saved ? "Paste a new one to replace it" : `Paste it here (starts with ${prefix})`}
          className="field flex-1 font-mono"
        />
        <button className={buttonClass("filled")} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="px-1 text-[13px] text-red">
          {state.message}
        </p>
      )}
    </form>
  );
}
