import "server-only";
import { TZDate } from "@date-fns/tz";
import { decodePolyline, fitView, project, type LatLng, type MapView } from "./geo";
import { computeRoute, MAP_SIZE, mapsAvailable, MapsError, type Leg, type TravelMode } from "./google/maps";
import { dayItems, nowAndNext } from "./now-next";
import { placeMap } from "./places";
import { travelTime, type TravelTable } from "./travel";
import type { DayView } from "./week";

const REAL = (p: string) => p !== "any" && p !== "online";

/** A local time on a date in the person's time zone, as a Date. */
export function dateAt(date: string, minutes: number, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new TZDate(y, m - 1, d, 0, minutes, tz);
}

export type RouteStop = { place: string; title: string; start: number | null; end: number | null; at: LatLng; x: number; y: number };
export type RouteLeg = Leg & { from: string; to: string; path: string };
export type DayRoute = { stops: RouteStop[]; legs: RouteLeg[]; view: MapView; minutes: number; meters: number; awayMinutes: number; missing: string[] };

/**
 * The day's trips on a map: home → each place you have to be (classes at school count once) → home,
 * with Google's route between each and the line already projected onto the map picture.
 * Null without a Maps key or with fewer than two located stops.
 */
export async function routeForDay(uid: number, day: DayView, { tz, mode }: { tz: string; mode: TravelMode }): Promise<DayRoute | null> {
  if (!(await mapsAvailable(uid))) return null;
  const located = await placeMap(uid);
  // Consecutive items at the same place become one stop.
  const raw: { place: string; title: string; start: number; end: number }[] = [];
  for (const it of dayItems(day).filter((i) => REAL(i.place))) {
    const last = raw.at(-1);
    if (last && last.place === it.place) last.end = Math.max(last.end, it.end);
    else raw.push({ place: it.place, title: it.place === "school" ? "School" : it.title, start: it.start, end: it.end });
  }
  if (!raw.length) return null;
  const missing = [...new Set(raw.map((r) => r.place).filter((p) => !located.has(p)))];
  const home = located.get("home");
  const stops: Omit<RouteStop, "x" | "y">[] = [
    ...(home ? [{ place: "home", title: "Home", start: null, end: raw[0].start, at: home }] : []),
    ...raw.flatMap((r) => (located.has(r.place) ? [{ ...r, at: located.get(r.place)! }] : [])),
    ...(home ? [{ place: "home", title: "Home", start: raw.at(-1)!.end, end: null, at: home }] : []),
  ].map((s) => ({ ...s, at: { lat: s.at.lat, lng: s.at.lng } }));
  if (stops.length < 2) return null;

  const legs: (Leg & { from: string; to: string })[] = [];
  for (let k = 1; k < stops.length; k++) {
    const a = stops[k - 1];
    const b = stops[k];
    if (a.place === b.place) continue;
    const leave = a.end ?? b.start;
    try {
      const leg = await computeRoute(uid, a.at, b.at, mode, leave != null ? dateAt(day.date, leave, tz) : undefined);
      if (leg) legs.push({ ...leg, from: a.place, to: b.place });
    } catch (err) {
      if (err instanceof MapsError && err.status === 429) break;
      throw err;
    }
  }
  const lines = legs.map((l) => decodePolyline(l.polyline));
  const view = fitView([...stops.map((s) => s.at), ...lines.flat()], MAP_SIZE.width, MAP_SIZE.height, { padding: 36 });
  const path = (pts: LatLng[]) =>
    pts
      .map((p, i) => {
        const { x, y } = project(p, view);
        return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join("");
  const first = raw[0].start;
  const lastEnd = raw.at(-1)!.end;
  return {
    stops: stops.map((s) => ({ ...s, ...project(s.at, view) })),
    legs: legs.map((l, i) => ({ ...l, path: path(lines[i]) })),
    view,
    minutes: legs.reduce((n, l) => n + l.minutes, 0),
    meters: legs.reduce((n, l) => n + l.meters, 0),
    awayMinutes: home ? lastEnd - first + (legs[0]?.minutes ?? 0) + (legs.at(-1)?.minutes ?? 0) : lastEnd - first,
    missing,
  };
}

/**
 * Now / next / leave-by like nowAndNext, but "leave by" comes from Google's live route when both
 * places have addresses (traffic for car, timetables for transit). Falls back to the travel table.
 */
export async function liveNowAndNext(uid: number, day: DayView, now: number, travel: TravelTable, opts: { tz: string; mode: TravelMode; gymExtraMinutes: number }) {
  const base = nowAndNext(day, now, travel);
  const { next } = base;
  if (!next || !REAL(next.place) || !(await mapsAvailable(uid))) return { ...base, live: false };
  const items = dayItems(day);
  const before = items.filter((i) => i.end <= next.start && REAL(i.place)).pop();
  const from = before?.place ?? "home";
  if (from === next.place) return { ...base, live: false };
  const located = await placeMap(uid);
  const a = located.get(from);
  const b = located.get(next.place);
  if (!a || !b) return { ...base, live: false };
  try {
    const guess = travelTime(travel, from, next.place) ?? 30;
    const leg = await computeRoute(uid, a, b, opts.mode, dateAt(day.date, Math.max(now, next.start - guess), opts.tz));
    if (!leg) return { ...base, live: false };
    const minutes = leg.minutes + (from === "gym" ? opts.gymExtraMinutes : 0);
    return { ...base, leaveBy: next.start - minutes, live: true, travelMinutes: minutes };
  } catch {
    return { ...base, live: false };
  }
}
