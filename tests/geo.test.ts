import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePolyline, fitView, project } from "../src/lib/geo.ts";

test("decodes Google's example polyline", () => {
  const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  assert.deepEqual(
    pts.map((p) => [Number(p.lat.toFixed(3)), Number(p.lng.toFixed(3))]),
    [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ],
  );
});

test("the fitted view puts every point inside the image, with padding", () => {
  const pts = [
    { lat: 44.4268, lng: 26.1025 },
    { lat: 44.45, lng: 26.08 },
    { lat: 44.41, lng: 26.13 },
  ];
  const view = fitView(pts, 640, 360, { padding: 40 });
  for (const p of pts) {
    const { x, y } = project(p, view);
    assert.ok(x >= 40 - 1 && x <= 600 + 1, `x ${x}`);
    assert.ok(y >= 40 - 1 && y <= 320 + 1, `y ${y}`);
  }
  // The centre lands in the middle of the image.
  const c = project(view.center, view);
  assert.ok(Math.abs(c.x - 320) < 0.01 && Math.abs(c.y - 180) < 0.01);
  // One zoom further would not fit any more.
  const tighter = { ...view, zoom: view.zoom + 1 };
  const outside = pts.some((p) => {
    const q = project(p, tighter);
    return q.x < 40 || q.x > 600 || q.y < 40 || q.y > 320;
  });
  assert.ok(outside);
});
