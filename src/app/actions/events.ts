"use server";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteEvent, getEvent, insertEvent, listCalendars, moveEvent, patchEvent, type EventBody } from "@/lib/google/calendar";
import { getSettings } from "@/lib/settings";
import { addDays } from "@/lib/time";

export type EventFormState = { ok: boolean; message: string; at: number } | null;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const RULES = { daily: "FREQ=DAILY", weekly: "FREQ=WEEKLY", biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY" } as const;

const input = z.object({
  calendarId: z.string().min(1).max(300),
  eventId: z.string().max(300).optional(),
  fromCalendarId: z.string().max(300).optional(),
  seriesId: z.string().max(300).optional(), // set when editing one occurrence of a repeating event
  scope: z.enum(["this", "all"]).catch("this"),
  title: z.string().trim().min(1, "Give the event a title").max(300),
  allDay: z.boolean(),
  date,
  endDate: date.optional(),
  start: time.optional(),
  end: time.optional(),
  repeat: z.enum(["none", "daily", "weekly", "biweekly", "monthly"]).catch("none"),
  until: z.union([z.literal(""), date]).catch(""),
  location: z.string().trim().max(200),
  notes: z.string().max(5000),
});

const opt = (v: FormDataEntryValue | null) => (v ? String(v) : undefined);

function parse(fd: FormData) {
  const allDay = fd.get("allDay") === "on";
  return input.safeParse({
    calendarId: fd.get("calendarId"),
    eventId: opt(fd.get("eventId")),
    fromCalendarId: opt(fd.get("fromCalendarId")),
    seriesId: opt(fd.get("seriesId")),
    scope: fd.get("scope"),
    title: fd.get("title"),
    allDay,
    date: fd.get("date"),
    endDate: opt(fd.get("endDate")),
    start: allDay ? undefined : opt(fd.get("start")),
    end: allDay ? undefined : opt(fd.get("end")),
    repeat: fd.get("repeat"),
    until: fd.get("until") ?? "",
    location: fd.get("location") ?? "",
    notes: fd.get("notes") ?? "",
  });
}

const fail = (message: string): EventFormState => ({ ok: false, message, at: Date.now() });

async function assertWritable(uid: number, ...ids: (string | undefined)[]) {
  const writable = new Set((await listCalendars(uid)).filter((c) => c.writable).map((c) => c.id));
  for (const id of ids) if (id && !writable.has(id)) throw new Error("You can't change events in that calendar.");
}

/** Creates or edits an event in any of your Google calendars. */
export async function saveCalendarEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const user = await requireUser();
  const parsed = parse(fd);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const v = parsed.data;
  const tz = (await getSettings(user.id)).timezone;

  let start: EventBody["start"];
  let end: EventBody["end"];
  if (v.allDay) {
    const last = v.endDate && v.endDate >= v.date ? v.endDate : v.date;
    start = { date: v.date };
    end = { date: addDays(last, 1) };
  } else {
    if (!v.start || !v.end) return fail("Add a start and end time");
    // An end time at or before the start on the same day means it runs past midnight (e.g. 22:00–00:00).
    let endDate = v.endDate ?? v.date;
    if (endDate === v.date && v.end <= v.start) endDate = addDays(v.date, 1);
    if (`${endDate}T${v.end}` <= `${v.date}T${v.start}`) return fail("The event must end after it starts");
    start = { dateTime: `${v.date}T${v.start}:00`, timeZone: tz };
    end = { dateTime: `${endDate}T${v.end}:00`, timeZone: tz };
  }
  const body: EventBody = { summary: v.title, location: v.location, description: v.notes, start, end };
  if (v.repeat !== "none") {
    const until = v.until ? `;UNTIL=${v.until.replace(/-/g, "")}${v.allDay ? "" : "T235959Z"}` : "";
    body.recurrence = [`RRULE:${RULES[v.repeat]}${until}`];
  }

  try {
    await assertWritable(user.id, v.calendarId, v.fromCalendarId);
    if (!v.eventId) {
      await insertEvent(user.id, v.calendarId, body);
    } else if (v.seriesId && v.scope === "all") {
      // Whole series: keep its first date and repeat rule, change everything else.
      const from = v.fromCalendarId ?? v.calendarId;
      if (from !== v.calendarId) await moveEvent(user.id, from, v.seriesId, v.calendarId);
      const master = await getEvent(user.id, v.calendarId, v.seriesId);
      const first = master.start.date ?? format(new TZDate(master.start.dateTime!, tz), "yyyy-MM-dd");
      const shift = (d: string) => addDays(first, Math.round((Date.parse(d) - Date.parse(v.date)) / 86_400_000));
      delete body.recurrence;
      body.start = start.date ? { date: first } : { dateTime: `${first}T${v.start}:00`, timeZone: tz };
      body.end = end.date ? { date: shift(end.date) } : { dateTime: `${shift(end.dateTime!.slice(0, 10))}T${v.end}:00`, timeZone: tz };
      await patchEvent(user.id, v.calendarId, v.seriesId, body);
    } else {
      if (v.seriesId) delete body.recurrence; // one occurrence can't repeat on its own
      const from = v.fromCalendarId ?? v.calendarId;
      if (from !== v.calendarId) {
        if (v.seriesId) return fail("Move the whole series (All events) to change its calendar");
        await moveEvent(user.id, from, v.eventId, v.calendarId);
      }
      await patchEvent(user.id, v.calendarId, v.eventId, body);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Google Calendar didn't accept the change");
  }
  revalidatePath("/", "layout");
  return { ok: true, message: v.eventId ? "Saved" : "Added", at: Date.now() };
}

export async function deleteCalendarEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const seriesId = opt(fd.get("seriesId"));
  const eventId = String(fd.get("eventId") ?? "");
  return deleteEventNow(String(fd.get("calendarId") ?? ""), seriesId && fd.get("scope") === "all" ? seriesId : eventId);
}

/** Deletes one event (or a whole series, given its id). Used by the form and the right-click menu. */
export async function deleteEventNow(calendarId: string, eventId: string): Promise<EventFormState> {
  const user = await requireUser();
  const ids = z.object({ calendarId: z.string().min(1).max(300), eventId: z.string().min(1).max(300) }).parse({ calendarId, eventId });
  try {
    await assertWritable(user.id, ids.calendarId);
    await deleteEvent(user.id, ids.calendarId, ids.eventId);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Couldn't delete the event");
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Deleted", at: Date.now() };
}
