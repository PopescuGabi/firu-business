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
