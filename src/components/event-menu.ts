import { deleteEventNow } from "@/app/actions/events";
import type { MenuItem } from "./context-menu";

/** Right-click actions for a Google event you can change (built on the server, run from the menu). */
export function eventMenu(e: { calendarId: string; id: string; recurringEventId?: string }): MenuItem[] {
  if (!e.recurringEventId) return [{ label: "Delete event", destructive: true, action: deleteEventNow.bind(null, e.calendarId, e.id) }];
  return [
    { label: "Delete this event", destructive: true, action: deleteEventNow.bind(null, e.calendarId, e.id) },
    {
      label: "Delete all events in the series",
      destructive: true,
      confirm: "Delete every event in this repeating series?",
      action: deleteEventNow.bind(null, e.calendarId, e.recurringEventId),
    },
  ];
}
