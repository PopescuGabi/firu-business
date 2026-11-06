"use client";
import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { saveCalendarSync, syncCalendarNow, type SyncFormState } from "@/app/actions/settings";
import { buttonClass } from "./ui";

export function CalendarSyncForm({
  enabled,
  hasCalendar,
  lastSync,
}: {
  enabled: boolean;
  hasCalendar: boolean;
  lastSync: string | null;
}) {
  const [saved, save, saving] = useActionState<SyncFormState, FormData>(saveCalendarSync, null);
  const [synced, sync, syncing] = useActionState<SyncFormState, FormData>(syncCalendarNow, null);
  const state = synced ?? saved;
  const busy = saving || syncing;
  return (
    <div className="flex flex-col gap-4">
      {!hasCalendar && (
        <p className="text-[14px] text-label-2">
          Create a calendar named <strong>Personal Hub</strong> in Google Calendar (Other calendars → +) first, then turn sync on.
        </p>
      )}
      <form action={save} className="flex flex-col gap-4">
        <label className="flex items-center gap-2.5 text-[15px]">
          <input type="checkbox" name="calendarSync" defaultChecked={enabled} className="size-4 accent-[var(--blue)]" />
          Two-way sync with the Personal Hub calendar
        </label>
        <button className={`${buttonClass("filled")} self-end`} disabled={busy}>
          {saving ? "Syncing…" : "Save"}
        </button>
      </form>
      {enabled && (
        <form action={sync} className="flex items-center justify-between gap-3 border-t border-separator pt-3">
          <span className="text-[13px] text-label-2">
            {lastSync ? `Last synced ${new Date(lastSync).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "Not synced yet"}
          </span>
          <button className={buttonClass("gray", "sm")} disabled={busy}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync now"}
          </button>
        </form>
      )}
      {state && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>
          {state.message}
        </p>
      )}
    </div>
  );
}
