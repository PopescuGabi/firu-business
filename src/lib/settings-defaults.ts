// Every default here is visible and editable on the Settings page.
export const DEFAULT_SETTINGS = {
  // Shown in the Home greeting.
  displayName: "",
  timezone: "UTC",
  classMinutes: 50,
  breakMinutes: 10,
  dayStart: "07:00",
  // On days without school (weekends, holidays), nothing is planned before this.
  freeDayStart: "10:00",
  dayEnd: "22:30",
  // Google Calendar ids to read events from (empty = all calendars you can see).
  calendarIds: [] as string[],
  // Two-way sync with a Google calendar named "Personal Hub" (turn on in Settings).
  calendarSync: false,
  // Last school day; weekly classes in Google Calendar stop after it.
  schoolYearEnd: "",
  // Minutes from one place to another ("from>to"). Gym → X includes showering and changing.
  // Set yours in Settings → Travel times.
  travel: {} as Record<string, number>,
  // App background: a built-in (lib/backgrounds.ts) or "photo" (your upload).
  background: "default",
  // Light, dark, or "auto" (follows the device).
  theme: "auto" as "auto" | "light" | "dark",
  // Little interface sounds (taps, toggles, a chime when something is saved).
  sounds: true,
  // Google Maps (with your own key): how you usually travel, and minutes added after the gym (shower, changing).
  travelMode: "transit" as "transit" | "drive" | "walk" | "bicycle",
  gymExtraMinutes: 15,
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
  dailyTargets: { date: string; studyMin: number; projectMin: number; gymMin: number; note: string }[];
  createdAt: string;
  source: "ai" | "basic";
};
