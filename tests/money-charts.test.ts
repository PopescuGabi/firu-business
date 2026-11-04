import { test } from "node:test";
import assert from "node:assert/strict";
import { compact, niceMax, points, slices, ticks } from "../src/lib/chart-scale.ts";
import { convertCents, parseAmount, rateOn } from "../src/lib/fx-math.ts";

test("axis maximums and ticks are round numbers", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(1234), 2000);
  assert.equal(niceMax(2300), 2500);
  assert.equal(niceMax(48_000), 50_000);
  assert.deepEqual(ticks(1234), [0, 500, 1000, 1500, 2000]);
  assert.deepEqual(ticks(4200), [0, 1000, 2000, 3000, 4000, 5000]);
});

test("series points fill the box; donut slices add up to the whole", () => {
  const pts = points([0, 50, 100], 200, 100, 100);
  assert.deepEqual(pts, [{ x: 0, y: 100 }, { x: 100, y: 50 }, { x: 200, y: 0 }]);
  const s = slices([{ value: 1 }, { value: 3 }, { value: 0 }]);
  assert.equal(s.length, 2);
  assert.equal(s[0].value, 3);
  assert.equal(s[0].start, 0);
  assert.equal(s[1].start, 0.75);
  assert.equal(s.reduce((n, x) => n + x.share, 0), 1);
  assert.equal(compact(1234), "1.2k");
  assert.equal(compact(34_567), "35k");
});

test("RON and EUR convert at the day's rate, weekends using the Friday before", () => {
  assert.equal(convertCents(10_000, "EUR", "RON", 5.0835), 50_835);
  assert.equal(convertCents(50_835, "RON", "EUR", 5.0835), 10_000);
  assert.equal(convertCents(123, "RON", "RON", 5), 123);
  const rates = new Map([
    ["2026-10-30", 5.1],
    ["2026-11-02", 5.2],
  ]);
  const dates = [...rates.keys()].sort();
  assert.equal(rateOn("2026-11-01", rates, dates), 5.1); // Sunday → Friday's rate
  assert.equal(rateOn("2026-11-02", rates, dates), 5.2);
  assert.equal(rateOn("2026-10-01", rates, dates), 5.1); // before the cache: the oldest rate
});

test("amounts typed with a dot or a comma", () => {
  assert.equal(parseAmount("1234.5"), 123_450);
  assert.equal(parseAmount("1.234,50"), 123_450);
  assert.equal(parseAmount("1,234.50"), 123_450);
  assert.equal(parseAmount("250"), 25_000);
  assert.equal(parseAmount("12,5"), 1250);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("0"), null);
});
