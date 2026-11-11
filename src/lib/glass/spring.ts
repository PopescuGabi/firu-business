// A damped spring turned into a CSS `linear()` easing, so springy motion runs on the compositor
// with ordinary transitions and Web Animations instead of a JavaScript animation loop.

export type SpringCurve = { easing: string; duration: number };

const cache = new Map<string, SpringCurve>();

/** Simulates x'' = -k(x-1) - c x' (mass 1) from 0 to rest and samples it into linear(). */
export function springCurve(stiffness: number, damping: number, maxDuration = 1.2): SpringCurve {
  const key = `${stiffness}|${damping}|${maxDuration}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  const samples: number[] = [0];
  let t = 0;
  let settledFor = 0;
  while (t < maxDuration) {
    const a = -stiffness * (x - 1) - damping * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    samples.push(x);
    settledFor = Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01 ? settledFor + dt : 0;
    if (settledFor > 0.05) break;
  }
  // Keep about 40 points: enough for a smooth curve, short enough for a CSS value.
  const step = Math.max(1, Math.floor(samples.length / 40));
  const pts: string[] = [];
  for (let i = 0; i < samples.length; i += step) pts.push(+samples[i].toFixed(4) + "");
  pts.push("1");
  const curve = { easing: `linear(${pts.join(", ")})`, duration: Math.round(t * 1000) };
  cache.set(key, curve);
  return curve;
}
