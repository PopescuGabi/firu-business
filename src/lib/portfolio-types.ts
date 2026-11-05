// Pure helpers (no server imports) so the Portfolio forms can use them in the browser too.
import type { DriveFile } from "./db/schema";

export const PORTFOLIO_TYPES = [
  ["reel", "Reel"],
  ["carousel", "Carousel"],
  ["video", "Video"],
  ["photo", "Photo"],
  ["design", "Design"],
  ["app", "App / website"],
  ["document", "Document"],
  ["other", "Other"],
] as const;
export type PortfolioType = (typeof PORTFOLIO_TYPES)[number][0];
export const typeLabel = (t: string) => PORTFOLIO_TYPES.find(([k]) => k === t)?.[1] ?? "Other";

/** An optional https address; anything else (or empty) means none. */
export function cleanUrl(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The address without https:// and a trailing slash, for buttons. */
export const shortUrl = (u: string) => u.replace(/^https:\/\//, "").replace(/\/$/, "");

/** The file shown on the card: the chosen cover, else the first image or video. */
export function coverOf(item: { files: DriveFile[]; coverFileId: string | null }) {
  return (
    item.files.find((f) => f.id === item.coverFileId) ??
    item.files.find((f) => f.mimeType.startsWith("image/")) ??
    item.files.find((f) => f.mimeType.startsWith("video/")) ??
    null
  );
}
