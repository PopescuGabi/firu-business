import "server-only";
import { googleFetch } from "./oauth";

const API = "https://www.googleapis.com/calendar/v3";

export type CalendarInfo = { id: string; name: string; color: string; primary: boolean };
export type CalendarEvent = {
  id: string;
  calendarId: string;
  calendarName: string;
  color: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  htmlLink?: string;
  recurringEventId?: string;
};

export async function listCalendars(): Promise<CalendarInfo[]> {
  const res = await googleFetch(`${API}/users/me/calendarList?minAccessRole=reader`);
  const data = (await res.json()) as {
    items: { id: string; summary: string; backgroundColor?: string; primary?: boolean; selected?: boolean }[];
  };
  return data.items.map((c) => ({
    id: c.id,
    name: c.summary,
    color: c.backgroundColor ?? "#8E8E93",
    primary: Boolean(c.primary),
  }));
}

export async function listEvents(timeMin: Date, timeMax: Date, calendarIds: string[]): Promise<CalendarEvent[]> {
  const calendars = await listCalendars();
  const wanted = calendarIds.length ? calendars.filter((c) => calendarIds.includes(c.id)) : calendars;
  const results = await Promise.all(
    wanted.map(async (cal) => {
      const url = new URL(`${API}/calendars/${encodeURIComponent(cal.id)}/events`);
      url.search = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      }).toString();
      const res = await googleFetch(url.toString());
      const data = (await res.json()) as {
        items: {
          id: string;
          summary?: string;
          status?: string;
          htmlLink?: string;
          transparency?: string;
          recurringEventId?: string;
          start: { dateTime?: string; date?: string };
          end: { dateTime?: string; date?: string };
        }[];
      };
      return data.items
        .filter((e) => e.status !== "cancelled")
        .map<CalendarEvent>((e) => ({
          id: e.id,
          calendarId: cal.id,
          calendarName: cal.name,
          color: cal.color,
          title: e.summary ?? "(no title)",
          start: e.start.dateTime ?? e.start.date!,
          end: e.end.dateTime ?? e.end.date!,
          allDay: !e.start.dateTime,
          htmlLink: e.htmlLink,
          recurringEventId: e.recurringEventId,
        }));
    }),
  );
  return results.flat();
}

export async function createEvent(
  calendarId: string,
  ev: { title: string; description: string; start: string; end: string; timeZone: string; recurrence?: string[] },
) {
  const res = await googleFetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: ev.title,
      description: ev.description,
      start: { dateTime: ev.start, timeZone: ev.timeZone },
      end: { dateTime: ev.end, timeZone: ev.timeZone },
      recurrence: ev.recurrence,
      source: { title: "Personal Hub", url: process.env.APP_URL },
    }),
  });
  return ((await res.json()) as { id: string }).id;
}

export async function deleteEvent(calendarId: string, eventId: string) {
  await googleFetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  }).catch((err: Error) => {
    if (!err.message.includes("410") && !err.message.includes("404")) throw err;
  });
}

// ── Raw event access for two-way sync ─────────────────────
export type RawEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  recurringEventId?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
};
export type EventBody = Omit<RawEvent, "id" | "status" | "updated" | "recurringEventId">;

const eventsUrl = (calendarId: string, eventId?: string) =>
  `${API}/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ""}`;

export async function insertEvent(calendarId: string, body: EventBody): Promise<RawEvent> {
  const res = await googleFetch(eventsUrl(calendarId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function patchEvent(calendarId: string, eventId: string, body: EventBody): Promise<RawEvent> {
  const res = await googleFetch(eventsUrl(calendarId, eventId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Events changed since `updatedMin` (including deleted ones), as series masters, not instances. */
export async function changedEvents(calendarId: string, updatedMin: string): Promise<RawEvent[]> {
  const out: RawEvent[] = [];
  let pageToken = "";
  do {
    const url = new URL(eventsUrl(calendarId));
    url.search = new URLSearchParams({
      updatedMin,
      showDeleted: "true",
      singleEvents: "false",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const data = (await (await googleFetch(url.toString())).json()) as { items: RawEvent[]; nextPageToken?: string };
    out.push(...data.items);
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function getEvent(calendarId: string, eventId: string): Promise<RawEvent> {
  return (await googleFetch(eventsUrl(calendarId, eventId))).json();
}
