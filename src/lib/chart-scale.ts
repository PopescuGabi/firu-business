// Small helpers behind the charts (pure, so they're tested).

/** A round number at or above `max` (1, 2, 2.5, 5 × 10ⁿ), so axis ticks look tidy. */
export function niceMax(max: number) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

/** Evenly spaced ticks from 0 to niceMax(max), split into 4, 5 or 3 so each step is a round number. */
export function ticks(max: number) {
  const top = niceMax(max);
  const round = (step: number) => {
    const m = step / 10 ** Math.floor(Math.log10(step));
    return [1, 2, 2.5, 5].some((x) => Math.abs(m - x) < 1e-9);
  };
  const count = [4, 5, 3].find((c) => round(top / c)) ?? 4;
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i);
}

/** Points of a series across a width × height box (y grows downward), scaled to `top`. */
export function points(values: number[], width: number, height: number, top: number) {
  const n = values.length;
  return values.map((v, i) => ({ x: n === 1 ? width / 2 : (i / (n - 1)) * width, y: height - (Math.max(0, v) / (top || 1)) * height }));
}

export const linePath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("");

export const areaPath = (pts: { x: number; y: number }[], height: number) =>
  pts.length ? `${linePath(pts)}L${pts.at(-1)!.x.toFixed(2)} ${height}L${pts[0].x.toFixed(2)} ${height}Z` : "";

/** Donut slices as fractions of a whole (0..1 start/length), largest first; tiny slices are kept. */
export function slices<T extends { value: number }>(parts: T[]) {
  const total = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  let at = 0;
  return [...parts]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((p) => {
      const share = total ? p.value / total : 0;
      const s = { ...p, start: at, share };
      at += share;
      return s;
    });
}

/** Short numbers for axes and tiles: 950, 1.2k, 34k, 1.5M. */
export function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}
