import "server-only";
import type { LatLng } from "../geo";
import { mapsKeyFor } from "../users";

// Google Maps Platform, always with the person's own key (server side only):
// Places (New) for address search, Routes for travel times and route lines, Static Maps for the picture.

const PLACES = "https://places.googleapis.com/v1";
const ROUTES = "https://routes.googleapis.com";

export class MapsError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type TravelMode = "transit" | "drive" | "walk" | "bicycle";
export const TRAVEL_MODES: { key: TravelMode; label: string }[] = [
  { key: "transit", label: "Public transport" },
  { key: "drive", label: "Car" },
  { key: "walk", label: "Walking" },
  { key: "bicycle", label: "Bike" },
];
const GOOGLE_MODE: Record<TravelMode, string> = { transit: "TRANSIT", drive: "DRIVE", walk: "WALK", bicycle: "BICYCLE" };

/** Whether this person has added a Maps key (without revealing it). */
export async function mapsAvailable(uid: number) {
  return Boolean(await mapsKeyFor(uid));
}

// A soft cap per person per day, so a loop or a stuck page can't run up their bill.
const DAILY_LIMIT = 600;
const counts = new Map<string, number>();
function count(uid: number) {
  const k = `${uid}:${new Date().toISOString().slice(0, 10)}`;
  const n = (counts.get(k) ?? 0) + 1;
  counts.set(k, n);
  if (n > DAILY_LIMIT) throw new MapsError(`FIRU Business's daily limit of ${DAILY_LIMIT} Google Maps lookups is reached. It resets tomorrow.`, 429);
}

async function call(uid: number, url: string, { body, fieldMask }: { body?: unknown; fieldMask?: string } = {}) {
  const key = await mapsKeyFor(uid);
  if (!key) throw new MapsError("Add your Google Maps key in Settings first.", 503);
  count(uid);
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "X-Goog-Api-Key": key, ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    let message: string | undefined;
    try {
      message = JSON.parse(text).error?.message;
    } catch {}
    throw new MapsError(message ? `Google Maps: ${message}` : `Google Maps error ${res.status}`, res.status === 403 ? 403 : 502);
  }
  return res;
}

// ── Places ────────────────────────────────────────────────────

export async function autocomplete(uid: number, input: string, sessionToken: string) {
  const res = await call(uid, `${PLACES}/places:autocomplete`, { body: { input, sessionToken } });
  const data = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; text: { text: string } } }[] };
  return (data.suggestions ?? []).flatMap((s) => (s.placePrediction ? [{ placeId: s.placePrediction.placeId, text: s.placePrediction.text.text }] : []));
}

export async function placeDetails(uid: number, placeId: string, sessionToken?: string) {
  if (!/^[\w-]{10,300}$/.test(placeId)) throw new MapsError("Invalid place");
  const q = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const res = await call(uid, `${PLACES}/places/${placeId}${q}`, { fieldMask: "id,formattedAddress,location" });
  const p = (await res.json()) as { id: string; formattedAddress: string; location: { latitude: number; longitude: number } };
  return { placeId: p.id, address: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude };
}

// ── Routes ────────────────────────────────────────────────────

const latLng = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const seconds = (d?: string) => (d ? Math.round(parseFloat(d)) : 0); // "754s"
/** Google wants future departure times only; anything earlier means "now". */
const departure = (at?: Date) => (at && at.getTime() > Date.now() + 60_000 ? { departureTime: at.toISOString() } : {});

/** Minutes and metres between every pair of points (null where Google found no route). */
export async function routeMatrix(uid: number, points: LatLng[], mode: TravelMode) {
  const res = await call(uid, `${ROUTES}/distanceMatrix/v2:computeRouteMatrix`, {
    fieldMask: "originIndex,destinationIndex,duration,distanceMeters,condition",
    body: {
      origins: points.map((p) => ({ waypoint: latLng(p) })),
      destinations: points.map((p) => ({ waypoint: latLng(p) })),
      travelMode: GOOGLE_MODE[mode],
      ...(mode === "drive" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
    },
  });
  const rows = (await res.json()) as { originIndex: number; destinationIndex: number; duration?: string; distanceMeters?: number; condition?: string }[];
  const out: ({ minutes: number; meters: number } | null)[][] = points.map(() => points.map(() => null));
  for (const r of rows) {
    if (r.condition !== "ROUTE_EXISTS") continue;
    out[r.originIndex][r.destinationIndex] = { minutes: Math.ceil(seconds(r.duration) / 60), meters: r.distanceMeters ?? 0 };
  }
  return out;
}

export type Leg = { minutes: number; meters: number; polyline: string };

const routeCache = new Map<string, { at: number; leg: Leg | null }>();
const ROUTE_TTL = 5 * 60_000;

/** One route (with its line), for live leave-by times and the day map. Cached for 5 minutes. */
export async function computeRoute(uid: number, from: LatLng, to: LatLng, mode: TravelMode, departAt?: Date): Promise<Leg | null> {
  const slot = departAt ? Math.round(departAt.getTime() / ROUTE_TTL) : 0;
  const k = [uid, mode, from.lat, from.lng, to.lat, to.lng, slot].join("|");
  const hit = routeCache.get(k);
  if (hit && Date.now() - hit.at < ROUTE_TTL) return hit.leg;
  const res = await call(uid, `${ROUTES}/directions/v2:computeRoutes`, {
    fieldMask: "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    body: {
      origin: latLng(from),
      destination: latLng(to),
      travelMode: GOOGLE_MODE[mode],
      ...(mode === "drive" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
      ...departure(departAt),
    },
  });
  const data = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };
  const r = data.routes?.[0];
  const leg = r ? { minutes: Math.ceil(seconds(r.duration) / 60), meters: r.distanceMeters ?? 0, polyline: r.polyline?.encodedPolyline ?? "" } : null;
  routeCache.set(k, { at: Date.now(), leg });
  if (routeCache.size > 500) routeCache.delete(routeCache.keys().next().value!);
  return leg;
}

// ── Static map picture ────────────────────────────────────────

// Night (dark) and porcelain (light) map styles, to sit under the glass.
const STYLES: Record<"dark" | "light", string[]> = {
  dark: [
    "element:geometry|color:0x1a1c21",
    "element:labels.text.fill|color:0x7d838f",
    "element:labels.text.stroke|color:0x121317",
    "element:labels.icon|visibility:off",
    "feature:road|element:geometry|color:0x2a2d34",
    "feature:road.highway|element:geometry|color:0x353944",
    "feature:water|element:geometry|color:0x0c1a2e",
    "feature:poi|visibility:off",
    "feature:transit|visibility:simplified",
    "feature:administrative|element:geometry|visibility:off",
  ],
  light: [
    "element:geometry|color:0xeceef3",
    "element:labels.text.fill|color:0x6b7180",
    "element:labels.text.stroke|color:0xffffff",
    "element:labels.icon|visibility:off",
    "feature:road|element:geometry|color:0xffffff",
    "feature:road.highway|element:geometry|color:0xdfe3ea",
    "feature:water|element:geometry|color:0xcfe0f6",
    "feature:poi|visibility:off",
    "feature:transit|visibility:simplified",
    "feature:administrative|element:geometry|visibility:off",
  ],
};

export const MAP_SIZE = { width: 640, height: 360 };

/** The map image (PNG bytes) for a centre and zoom, in the night or porcelain style. */
export async function staticMap(uid: number, center: LatLng, zoom: number, theme: "dark" | "light") {
  const key = await mapsKeyFor(uid);
  if (!key) throw new MapsError("Add your Google Maps key in Settings first.", 503);
  count(uid);
  const q = new URLSearchParams({
    center: `${center.lat.toFixed(6)},${center.lng.toFixed(6)}`,
    zoom: String(zoom),
    size: `${MAP_SIZE.width}x${MAP_SIZE.height}`,
    scale: "2",
    key,
  });
  for (const s of STYLES[theme]) q.append("style", s);
  const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${q}`, { cache: "no-store" });
  if (!res.ok) throw new MapsError(`Google Maps image error ${res.status}`, 502);
  return { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/png" };
}
