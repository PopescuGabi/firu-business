// Every default here is visible and editable on the Settings page.
export const DEFAULT_SETTINGS = {
  // Shown in the Home greeting.
  displayName: "",
  timezone: "UTC",
  // The working day: the planner only places blocks between these times.
  dayStart: "09:00",
  dayEnd: "20:00",
  // Google Calendar ids to read events from (empty = all calendars you can see).
  calendarIds: [] as string[],
  // Two-way sync with a Google calendar named "FIRU Business" (turn on in Settings).
  calendarSync: false,
  // Minutes from one place to another ("from>to"), e.g. home > a client's office. Set yours in Settings → Travel times.
  travel: {} as Record<string, number>,
  // App background: a built-in (lib/backgrounds.ts) or "photo" (your upload).
  background: "silk",
  // Light, dark, or "auto" (follows the device).
  theme: "auto" as "auto" | "light" | "dark",
  // Little interface sounds (taps, toggles, a chime when something is saved).
  sounds: true,
  // Google Maps (with your own key): how you usually travel.
  travelMode: "transit" as "transit" | "drive" | "walk" | "bicycle",
  // The currency money charts show (each entry is converted at its own date's ECB rate).
  moneyCurrency: "RON" as "RON" | "EUR",
  // What kind of business this is. b2b = works for other businesses; only then is the Clients section offered.
  // null = not asked yet (people from before this setting: their current sections decide).
  business: { kind: "", summary: "", b2b: null } as { kind: string; summary: string; b2b: boolean | null },
};

export type AppSettings = typeof DEFAULT_SETTINGS;

/** The last week plan's advice and daily targets (saved by the planner). */
export type PlanAdvice = {
  advice: string;
  dailyTargets: { date: string; projectMin: number; note: string }[];
  createdAt: string;
  source: "ai" | "basic";
};
