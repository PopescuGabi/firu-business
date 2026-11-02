"use client";
import { useActionState } from "react";
import { FileOutput } from "lucide-react";
import { createVercelEnvFile, type KeyFormState } from "@/app/actions/settings";
import { buttonClass } from "./ui";

export function VercelEnvForm() {
  const [state, action, pending] = useActionState<KeyFormState, FormData>(createVercelEnvFile, null);
  return (
    <form action={action} className="space-y-1.5 border-t border-separator pt-4">
      <label htmlFor="appUrl" className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-label-2">
        <FileOutput size={13} /> Settings file for Vercel
      </label>
      <div className="flex gap-2">
        <input
          id="appUrl"
          name="appUrl"
          required
          autoComplete="off"
          placeholder="Your Vercel address, e.g. https://my-hub.vercel.app"
          className="field flex-1"
        />
        <button className={buttonClass("tinted")} disabled={pending}>
          {pending ? "Creating…" : "Create file"}
        </button>
      </div>
      <p className="px-1 text-[12px] text-label-2">
        Writes every value Vercel needs (with a new session secret) into <code>.env.vercel</code> and opens it. The file stays on this Mac and is
        never uploaded to GitHub. Delete it after pasting.
      </p>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`px-1 text-[13px] ${state.ok ? "text-green" : "text-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
