// Pure: the product's name, in one place (titles, homepage, legal pages, emails).
export const APP_NAME = "Dashboard";
export const APP_TAGLINE = "Your business in one place: clients, leads, the calendar and your portfolio, with Jarvis on every page.";
/** Gabi's public portfolio website, shown live in the Portfolio tab. */
export const PORTFOLIO_SITE = { url: "https://gabi-popescu.vercel.app", label: "gabi-popescu.vercel.app" };

/** The voice assistant's name. */
export const ASSISTANT_NAME = "Jarvis";

/**
 * The name the app uses inside Google (the Drive root folder and the synced calendar). It stays as it was
 * when the app was renamed to "Dashboard", so existing folders and calendars keep matching.
 */
export const GOOGLE_NAME = "FIRU Business";

/** The app's earlier name: Google calendars, Drive folders and synced events made before the rename still carry it. */
export const LEGACY_APP_NAME = "Personal Hub";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

/** The Google calendar the app syncs with: one named GOOGLE_NAME, else one still named "Personal Hub". */
export function pickHubCalendar<T extends { name: string }>(calendars: T[]): T | null {
  return calendars.find((c) => same(c.name, GOOGLE_NAME)) ?? calendars.find((c) => same(c.name, LEGACY_APP_NAME)) ?? null;
}
