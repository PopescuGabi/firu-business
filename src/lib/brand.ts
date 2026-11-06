// Pure: the product's name, in one place (titles, homepage, legal pages, emails).
export const APP_NAME = "FIRU Business";
export const APP_TAGLINE = "Your marketing workspace: clients, content, Instagram results and the week to get it done.";

/** The app's earlier name: Google calendars, Drive folders and synced events made before the rename still carry it. */
export const LEGACY_APP_NAME = "Personal Hub";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

/** The Google calendar the app syncs with: one named "FIRU Business", else one still named "Personal Hub". */
export function pickHubCalendar<T extends { name: string }>(calendars: T[]): T | null {
  return calendars.find((c) => same(c.name, APP_NAME)) ?? calendars.find((c) => same(c.name, LEGACY_APP_NAME)) ?? null;
}
