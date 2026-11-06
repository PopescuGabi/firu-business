import { test } from "node:test";
import assert from "node:assert/strict";
import { addWidget, boardIds, collides, compact, firstFreeSpot, normalizeLayout, removeWidget, sizesFor, type Item, type WidgetDef } from "../src/lib/board.ts";

const defs: WidgetDef[] = [
  { id: "hero", size: { w: 6, h: 4 }, min: { w: 4, h: 3 } },
  { id: "tasks", size: { w: 3, h: 2 }, min: { w: 2, h: 2 }, max: { w: 4, h: 3 } },
  { id: "money", size: { w: 4, h: 4 } },
  { id: "inbox", size: { w: 4, h: 4 } },
];
const noOverlaps = (items: Item[]) => items.every((a) => items.every((b) => !collides(a, b)));
const inside = (items: Item[], cols: number) => items.every((it) => it.x >= 0 && it.x + it.w <= cols && it.y >= 0);

test("nothing saved: the fallback order is laid out on every size, without overlaps", () => {
  const b = normalizeLayout(null, defs, ["hero", "tasks", "money"]);
  assert.deepEqual(boardIds(b), ["hero", "tasks", "money"]);
  assert.deepEqual(b.computer.find((i) => i.i === "hero"), { i: "hero", x: 0, y: 0, w: 6, h: 4 });
  for (const [bp, cols] of [["computer", 12], ["tablet", 6], ["phone", 2]] as const) {
    assert.equal(b[bp].length, 3, bp);
    assert.ok(noOverlaps(b[bp]) && inside(b[bp], cols), bp);
  }
  // On a phone the small tile takes one of two columns, the big ones the full width.
  assert.equal(b.phone.find((i) => i.i === "tasks")!.w, 1);
  assert.equal(b.phone.find((i) => i.i === "hero")!.w, 2);
});

test("saved boards are cleaned: unknown or unavailable widgets go, sizes are clamped, overlaps fixed", () => {
  const saved = {
    computer: [
      { i: "hero", x: 0, y: 0, w: 6, h: 4 },
      { i: "tasks", x: 2, y: 1, w: 9, h: 1 }, // overlaps hero, too wide and too short
      { i: "gone", x: 0, y: 9, w: 3, h: 3 },
      { i: "hero", x: 6, y: 0, w: 3, h: 3 }, // duplicate
      { i: "money", x: 30, y: "x", w: 3, h: 3 }, // broken
    ],
  };
  const b = normalizeLayout(saved, defs, []);
  assert.deepEqual(boardIds(b), ["hero", "tasks"]);
  const tasks = b.computer.find((i) => i.i === "tasks")!;
  assert.deepEqual([tasks.w, tasks.h], [4, 2]);
  assert.ok(noOverlaps(b.computer) && inside(b.computer, 12));
});

test("an empty saved board stays empty (it isn't replaced by the default)", () => {
  assert.deepEqual(boardIds(normalizeLayout({ computer: [] }, defs, ["hero"])), []);
});

test("a phone layout arranged on its own is kept; widgets added elsewhere are appended to it", () => {
  const saved = {
    computer: [
      { i: "hero", x: 0, y: 0, w: 6, h: 4 },
      { i: "tasks", x: 6, y: 0, w: 3, h: 2 },
      { i: "money", x: 0, y: 4, w: 4, h: 4 },
    ],
    phone: [
      { i: "tasks", x: 0, y: 0, w: 2, h: 2 },
      { i: "hero", x: 0, y: 2, w: 2, h: 4 },
    ],
  };
  const b = normalizeLayout(saved, defs, []);
  assert.deepEqual(b.phone.slice(0, 2), saved.phone);
  assert.equal(b.phone[2].i, "money");
  assert.ok(b.phone[2].y >= 6);
});

test("turning a share off removes its widgets from every layout", () => {
  const full = normalizeLayout(null, defs, ["hero", "inbox", "money"]);
  const without = normalizeLayout(full, defs.filter((d) => d.id !== "inbox"), []);
  for (const bp of ["computer", "tablet", "phone"] as const) assert.ok(!without[bp].some((i) => i.i === "inbox"), bp);
});

test("adding a widget puts it in the first free spot on every size; a dropped one keeps its spot", () => {
  let b = normalizeLayout(null, defs, ["hero"]);
  b = addWidget(b, defs[1]);
  assert.deepEqual(b.computer.find((i) => i.i === "tasks"), { i: "tasks", x: 6, y: 0, w: 3, h: 2 });
  for (const bp of ["computer", "tablet", "phone"] as const) assert.ok(b[bp].some((i) => i.i === "tasks") && noOverlaps(b[bp]));
  b = addWidget(b, defs[2], { bp: "computer", x: 0, y: 0 });
  assert.deepEqual(b.computer.find((i) => i.i === "money"), { i: "money", x: 0, y: 0, w: 4, h: 4 });
  assert.ok(noOverlaps(b.computer));
  b = removeWidget(b, "hero");
  assert.deepEqual(boardIds(b).sort(), ["money", "tasks"]);
});

test("grid helpers", () => {
  assert.deepEqual(firstFreeSpot([{ i: "a", x: 0, y: 0, w: 12, h: 2 }], { w: 4, h: 2 }, 12), { x: 0, y: 2 });
  assert.deepEqual(compact([{ i: "a", x: 0, y: 5, w: 4, h: 2 }], 12), [{ i: "a", x: 0, y: 0, w: 4, h: 2 }]);
  assert.deepEqual(sizesFor(defs[0], "tablet"), { size: { w: 3, h: 4 }, min: { w: 2, h: 3 }, max: { w: 6, h: 12 } });
});
