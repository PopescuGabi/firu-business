"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteCalendarEvent, saveCalendarEvent, type EventFormState } from "@/app/actions/events";
import { buttonClass, Field } from "./ui";

export type EditableEvent = {
  id: string;
  calendarId: string;
  seriesId?: string;
  title: string;
  allDay: boolean;
  date: string;
  endDate: string; // last day, for all-day events
  start: string;
  end: string;
  location: string;
  notes: string;
};

/** Add or edit a Google Calendar event. Lives inside a <Sheet> and closes it after saving. */
export function EventForm({
  calendars,
  defaultCalendarId,
  defaultDate,
  places,
  event,
}: {
  calendars: { id: string; name: string; color: string }[];
  defaultCalendarId: string;
  defaultDate: string;
  places: string[];
  event?: EditableEvent;
}) {
  const [saved, save, saving] = useActionState<EventFormState, FormData>(saveCalendarEvent, null);
  const [deleted, remove, deleting] = useActionState<EventFormState, FormData>(deleteCalendarEvent, null);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [repeat, setRepeat] = useState("none");
  const [scope, setScope] = useState<"this" | "all">("this");
  const ref = useRef<HTMLDivElement>(null);
  const state = [saved, deleted].filter(Boolean).sort((a, b) => b!.at - a!.at)[0] ?? null;
  const listId = `places-${event?.id ?? "new"}`;

  useEffect(() => {
    if (state?.ok) ref.current?.closest("dialog")?.close();
  }, [state]);

  const series = Boolean(event?.seriesId);
  const hidden = event && (
    <>
      <input type="hidden" name="eventId" value={event.id} />
      {series && <input type="hidden" name="seriesId" value={event.seriesId} />}
      <input type="hidden" name="scope" value={scope} />
    </>
  );

  return (
    <div ref={ref} className="flex flex-col gap-4">
      {series && (
        <div className="flex rounded-lg bg-fill p-0.5 text-[14px] font-medium" role="radiogroup" aria-label="Change">
          {(["this", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              onClick={() => setScope(s)}
              className={`flex-1 cursor-pointer rounded-md py-1.5 transition ${scope === s ? "bg-card shadow-sm" : "text-label-2"}`}
            >
              {s === "this" ? "This event" : "All events"}
            </button>
          ))}
        </div>
      )}
      <form action={save} data-keep-open className="flex flex-col gap-4">
        {hidden}
        {event && <input type="hidden" name="fromCalendarId" value={event.calendarId} />}
        <Field label="Title">
          <input name="title" required maxLength={300} defaultValue={event?.title} className="field" autoFocus={!event} />
        </Field>
        <Field label="Calendar">
          <select name="calendarId" defaultValue={event?.calendarId ?? defaultCalendarId} className="field">
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2.5 text-[15px]">
          <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--blue)]" />
          All day
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label={allDay ? "From" : "Date"} hint={series && scope === "all" ? "The series keeps its days." : undefined}>
            <input type="date" name="date" required defaultValue={event?.date ?? defaultDate} className="field" />
          </Field>
          {allDay && (
            <Field label="Until">
              <input type="date" name="endDate" defaultValue={event?.endDate ?? event?.date ?? defaultDate} className="field" />
            </Field>
          )}
        </div>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input type="time" name="start" required defaultValue={event?.start || "16:00"} className="field" />
            </Field>
            <Field label="Ends">
              <input type="time" name="end" required defaultValue={event?.end || "17:00"} className="field" />
            </Field>
          </div>
        )}
        {series ? (
          <p className="px-1 text-[13px] text-label-2">Repeats. To change how it repeats, edit it in Google Calendar.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeat">
              <select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)} className="field">
                <option value="none">Never</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
              </select>
            </Field>
            {repeat !== "none" && (
              <Field label="Ends on" hint="Leave empty to repeat forever.">
                <input type="date" name="until" className="field" />
              </Field>
            )}
          </div>
        )}
        <Field label="Location" hint="Matching a place in your travel times lets the planner leave travel time around it.">
          <input name="location" maxLength={200} defaultValue={event?.location} list={listId} className="field" />
          <datalist id={listId}>
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} maxLength={5000} defaultValue={event?.notes} className="field" />
        </Field>
        {state && !state.ok && (
          <p role="alert" className="px-1 text-[13px] text-red">
            {state.message}
          </p>
        )}
        <button className={`${buttonClass("filled")} self-end`} disabled={saving || deleting}>
          {saving ? "Saving…" : event ? "Save" : "Add event"}
        </button>
      </form>
      {event && (
        <form action={remove} data-keep-open className="border-t border-separator pt-3">
          {hidden}
          <input type="hidden" name="calendarId" value={event.calendarId} />
          <button
            className={buttonClass("destructive")}
            disabled={saving || deleting}
            onClick={(e) => {
              const what = series && scope === "all" ? "every event in this series" : "this event";
              if (!confirm(`Delete ${what}?`)) e.preventDefault();
            }}
          >
            <Trash2 size={15} /> {deleting ? "Deleting…" : series && scope === "all" ? "Delete all events" : "Delete event"}
          </button>
        </form>
      )}
    </div>
  );
}
