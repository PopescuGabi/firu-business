import { toHHMM } from "./time.ts";

/**
 * Places: "school", "home", "gym", a tutoring place name, or
 * "online" (happens wherever you are) / "any" (Google event with no known place).
 * Travel times are minutes keyed "from>to"; gym→X includes showering and changing.
 */
export type TravelTable = Record<string, number>;
export type PlacedItem = { start: number; end: number; place: string; title: string; planned?: boolean };

const NEUTRAL = new Set(["online", "any"]);
const MIN_GAP_BETWEEN_PLANNED = 10;

/** Minutes needed to get from one place to the next; undefined when you haven't told me yet. */
export function travelTime(table: TravelTable, from: string, to: string): number | undefined {
  if (from === to || to === "any" || from === "any") return 0;
  if (to === "online") return from === "gym" ? table["gym>online"] : 0;
  return table[`${from}>${to}`];
}

type Transition = { from: PlacedItem | null; to: PlacedItem | null; fromPlace: string; toPlace: string; gap: number; need: number | undefined };

/** Every move between consecutive items, starting and ending the day at home. */
function transitions(items: PlacedItem[], table: TravelTable, dayStart: number, dayEnd: number): Transition[] {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const out: Transition[] = [];
  let place = "home";
  let prev: PlacedItem | null = null;
  let prevEnd = dayStart;
  for (const it of sorted) {
    out.push({ from: prev, to: it, fromPlace: place, toPlace: it.place, gap: it.start - prevEnd, need: travelTime(table, place, it.place) });
    if (!NEUTRAL.has(it.place)) place = it.place; // online/unknown-place events happen where you already are
    prev = it;
    prevEnd = Math.max(prevEnd, it.end);
  }
  out.push({ from: prev, to: null, fromPlace: place, toPlace: "home", gap: dayEnd - prevEnd, need: travelTime(table, place, "home") });
  return out;
}

/** Can the planned items sit here? Fixed-to-fixed clashes are reported separately and don't block planning. */
export function fitsDay(items: PlacedItem[], table: TravelTable, dayStart: number, dayEnd: number) {
  return transitions(items, table, dayStart, dayEnd).every((t) => {
    const involvesPlanned = Boolean(t.from?.planned || t.to?.planned);
    if (!involvesPlanned) return true;
    if (t.need === undefined) return false; // unknown travel time: don't guess
    const min = t.from?.planned && t.to?.planned ? Math.max(t.need, MIN_GAP_BETWEEN_PLANNED) : t.need;
    return t.gap >= min;
  });
}

export type Clash = { message: string };

/** Fixed sessions too close together (or travel time unknown), in plain words. */
export function fixedClashes(items: PlacedItem[], table: TravelTable, label: (p: string) => string): Clash[] {
  const out: Clash[] = [];
  const sorted = [...items].sort((a, b) => a.start - b.start);
  for (const t of transitions(sorted, table, 0, 24 * 60)) {
    if (!t.from || !t.to || t.fromPlace === t.toPlace) continue;
    if (t.gap < 0) {
      out.push({ message: `${t.from.title} (until ${toHHMM(t.from.end)}) overlaps ${t.to.title} (from ${toHHMM(t.to.start)}).` });
    } else if (t.need === undefined) {
      out.push({ message: `How long does it take from ${label(t.fromPlace)} to ${label(t.toPlace)}? Add it in Settings → Travel times.` });
    } else if (t.gap < t.need) {
      out.push({
        message: `Only ${t.gap} min between ${t.from.title} (ends ${toHHMM(t.from.end)}) and ${t.to.title} (starts ${toHHMM(t.to.start)}), but ${label(t.fromPlace)} → ${label(t.toPlace)} takes ${t.need} min.`,
      });
    }
  }
  return out;
}

/** The travel-table place an event's location names (case-insensitive), if any. */
export function knownPlace(location: string, table: TravelTable): string | null {
  const want = location.trim().toLowerCase();
  if (!want) return null;
  const places = new Set(Object.keys(table).flatMap((k) => k.split(">")));
  return [...places].find((p) => p.toLowerCase() === want) ?? null;
}
