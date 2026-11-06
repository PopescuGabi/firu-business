"use client";
import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { APP_NAME, LEGACY_APP_NAME } from "@/lib/brand";
import { saveCalendarSync, syncCalendarNow, type SyncFormState } from "@/app/actions/settings";
import { buttonClass } from "./ui";

export function CalendarSyncForm({
  enabled,
  calendarName,
  lastSync,
}: {
  enabled: boolean;
  /** The synced Google calendar's name as found (the new name or the old one), or null if there is none. */
  calendarName: string | null;
  lastSync: string | null;
}) {
  const [saved, save, saving] = useActionState<SyncFormState, FormData>(saveCalendarSync, null);
  const [synced, sync, syncing] = useActionState<SyncFormState, FormData>(syncCalendarNow, null);
  const state = synced ?? saved;
  const busy = saving || syncing;
  return (
    <div className="flex flex-col gap-4">
      {!calendarName && (
        <p className="text-[14px] text-label-2">
          Create a calendar named <strong>{APP_NAME}</strong> in Google Calendar (Other calendars → +) first, then turn sync on.
        </p>
      )}
      {calendarName?.toLowerCase() === LEGACY_APP_NAME.toLowerCase() && (
        <p className="rounded-[12px] bg-well px-3 py-2 text-[13px] text-label-2">
          Your calendar is still called <strong className="text-label">{LEGACY_APP_NAME}</strong>. Sync keeps working; to match the new name, rename it to{" "}
          <strong className="text-label">{APP_NAME}</strong> in Google Calendar (the calendar&apos;s settings → Name).
        </p>
      )}
      <form action={save} className="flex flex-col gap-4">
        <label className="flex items-center gap-2.5 text-[15px]">
          <input type="checkbox" name="calendarSync" defaultChecked={enabled} className="size-4 accent-[var(--blue)]" />
          Two-way sync with the {calendarName ?? APP_NAME} calendar
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
