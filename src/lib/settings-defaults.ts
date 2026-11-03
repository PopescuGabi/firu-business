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
  // Calendar that accepted plan blocks are written to.
  targetCalendarId: "primary",
};

export type AppSettings = typeof DEFAULT_SETTINGS;
