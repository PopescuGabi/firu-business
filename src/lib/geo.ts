// Map maths for drawing routes over a Google static map: decode route lines, pick a zoom that
// fits them, and project points to pixels with the same Web Mercator projection Google uses.

export type LatLng = { lat: number; lng: number };

/** Google's encoded polyline format → points. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < encoded.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const TILE = 256;

/** World pixel coordinates at zoom 0 (0..256). */
function world({ lat, lng }: LatLng) {
  const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: TILE * (0.5 + lng / 360), y: TILE * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) };
}

export type MapView = { center: LatLng; zoom: number; width: number; height: number };

/** The largest whole zoom (≤ maxZoom) that fits every point inside width×height with some padding. */
export function fitView(points: LatLng[], width: number, height: number, { padding = 48, maxZoom = 16 } = {}): MapView {
  if (!points.length) return { center: { lat: 0, lng: 0 }, zoom: 1, width, height };
  const w = points.map(world);
  const minX = Math.min(...w.map((p) => p.x));
  const maxX = Math.max(...w.map((p) => p.x));
  const minY = Math.min(...w.map((p) => p.y));
  const maxY = Math.max(...w.map((p) => p.y));
  let zoom = maxZoom;
  while (zoom > 1) {
    const k = 2 ** zoom;
    if ((maxX - minX) * k <= width - 2 * padding && (maxY - minY) * k <= height - 2 * padding) break;
    zoom--;
  }
  // Centre in world space (so the projection below matches), then back to lat/lng.
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const lng = (cx / TILE - 0.5) * 360;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * cy) / TILE))) * 180) / Math.PI;
  return { center: { lat, lng }, zoom, width, height };
}

/** A point's pixel position inside the static map image for this view. */
export function project(p: LatLng, view: MapView) {
  const k = 2 ** view.zoom;
  const c = world(view.center);
  const q = world(p);
  return { x: view.width / 2 + (q.x - c.x) * k, y: view.height / 2 + (q.y - c.y) * k };
}
