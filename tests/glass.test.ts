import { test } from "node:test";
import assert from "node:assert/strict";
import { springCurve } from "../src/lib/glass/spring.ts";
import { GLASS_MODES, liquidGlassTheme, resolveGlass } from "../src/lib/glass/theme.ts";

test("springCurve returns a CSS linear() easing that starts at 0 and settles at 1", () => {
  const { easing, duration } = springCurve(260, 22, 1.2);
  assert.match(easing, /^linear\(/);
  const stops = easing.slice(7, -1).split(",").map((s) => Number.parseFloat(s));
  assert.equal(stops[0], 0);
  assert.ok(Math.abs(stops.at(-1)! - 1) < 0.01);
  assert.ok(duration > 0 && duration <= 1200);
});

test("an underdamped spring overshoots; a heavily damped one doesn't", () => {
  const peak = (s: string) => Math.max(...s.slice(7, -1).split(",").map((x) => Number.parseFloat(x)));
  assert.ok(peak(springCurve(400, 10).easing) > 1);
  assert.ok(peak(springCurve(200, 60).easing) <= 1.0001);
});

test("resolveGlass applies the mode, then per-surface overrides", () => {
  const subtle = resolveGlass(liquidGlassTheme, "subtle");
  assert.equal(subtle.mode, "subtle");
  const expressive = resolveGlass(liquidGlassTheme, "expressive");
  assert.ok(expressive.optics.refractionStrength > subtle.optics.refractionStrength);
  const custom = resolveGlass(liquidGlassTheme, "balanced", { optics: { blurRadius: 3 } });
  assert.equal(custom.optics.blurRadius, 3);
  assert.ok(Object.keys(GLASS_MODES).length === 3);
});
