// Refraction maps for the SVG filter used in Tier 1.
//
// What this is: a displacement map that tells feDisplacementMap how far to pull each backdrop pixel.
// The surface is modelled as a slab whose rim curves down like a squircle; the bend follows the
// rim's slope, so it is strongest at the edge and zero in the flat centre, where text sits.
// What this is not: physically accurate optics. There is no ray tracing, thickness-dependent index
// or real caustics; it is a geometry-aware approximation that reads as curved glass.

export type MapShape = { width: number; height: number; radius: number };
export type MapOptics = { surfaceThickness: number; edgeDistortion: number };

const cache = new Map<string, string>();
const MAX_SIDE = 320; // maps are drawn small and stretched; the displacement field is smooth

/** Signed distance from point (px, py) to a rounded rectangle centred at the origin (negative inside). */
function sdRoundRect(px: number, py: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(px) - (hx - r);
  const qy = Math.abs(py) - (hy - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Slope of a squircle rim at depth t (0 = edge, 1 = where the rim meets the flat top). */
function rimSlope(t: number, sharpness: number) {
  // Height profile h(t) = (1 - (1 - t)^n)^(1/n); larger n = harder lip at the edge.
  const n = 2 + sharpness * 4;
  const e = 1e-3;
  const h = (u: number) => Math.pow(1 - Math.pow(1 - Math.min(Math.max(u, 0), 1), n), 1 / n);
  return (h(t + e) - h(t - e)) / (2 * e);
}

/** A PNG data URL: red = horizontal pull, green = vertical pull, 128 = none. Cached per shape. */
export function refractionMap(shape: MapShape, optics: MapOptics): string | null {
  if (typeof document === "undefined") return null;
  const { width, height } = shape;
  if (width < 8 || height < 8) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(8, Math.round(width * scale));
  const h = Math.max(8, Math.round(height * scale));
  const r = Math.min(shape.radius * scale, w / 2, h / 2);
  const key = `${w}x${h}r${r.toFixed(1)}t${optics.surfaceThickness}e${optics.edgeDistortion}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const hx = w / 2;
  const hy = h / 2;
  const bezel = Math.max(2, Math.min(hx, hy) * optics.surfaceThickness);
  // Normalise so the steepest slope maps to a full-strength pull.
  let peak = 0;
  for (let i = 0; i <= 50; i++) peak = Math.max(peak, rimSlope(i / 50, optics.edgeDistortion));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx;
      const py = y + 0.5 - hy;
      const d = -sdRoundRect(px, py, hx, hy, r); // depth inside the shape
      let dx = 0;
      let dy = 0;
      if (d > 0 && d < bezel) {
        // Outward normal from the distance field's gradient.
        const gx = sdRoundRect(px + 0.5, py, hx, hy, r) - sdRoundRect(px - 0.5, py, hx, hy, r);
        const gy = sdRoundRect(px, py + 0.5, hx, hy, r) - sdRoundRect(px, py - 0.5, hx, hy, r);
        const len = Math.hypot(gx, gy) || 1;
        const mag = rimSlope(d / bezel, optics.edgeDistortion) / peak;
        // A convex rim magnifies: each pixel shows backdrop from closer to the centre.
        dx = (-gx / len) * mag;
        dy = (-gy / len) * mag;
      }
      const o = (y * w + x) * 4;
      img.data[o] = Math.round(128 + dx * 127);
      img.data[o + 1] = Math.round(128 + dy * 127);
      img.data[o + 2] = 128;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL("image/png");
  if (cache.size > 64) cache.clear();
  cache.set(key, url);
  return url;
}
