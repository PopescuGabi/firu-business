import { test } from "node:test";
import assert from "node:assert/strict";
import { freeSlots, weekdayOf, mondayOf, addDays } from "../src/lib/time.ts";
import { basicPlan, validateBlocks, type DayContext } from "../src/lib/planner.ts";
import { extractJson } from "../src/lib/ai/extract-json.ts";
import { fitsDay, fixedClashes, travelTime } from "../src/lib/travel.ts";

test("free slots skip busy intervals", () => {
  const s = freeSlots(420, 1350, [{ start: 450, end: 860 }, { start: 1000, end: 1060 }]);
  assert.deepEqual(s, [{ start: 420, end: 450 }, { start: 860, end: 1000 }, { start: 1060, end: 1350 }]);
});

test("date helpers", () => {
  assert.equal(weekdayOf("2026-11-02"), 1); // Monday
  assert.equal(weekdayOf("2026-11-08"), 7); // Sunday
  assert.equal(mondayOf("2026-11-05"), "2026-11-02");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

// A client meeting at their office in the morning; the work day runs 09:00–20:00.
const travel = { "home>FIRU office": 30, "FIRU office>home": 30 };
const monday: DayContext = {
  date: "2026-11-02",
  weekday: 1,
  busy: [{ start: 600, end: 690, title: "Meeting with FIRU", kind: "calendar", place: "FIRU office" }],
};
const opts = { dayStart: "09:00", dayEnd: "20:00", travel };

test("basic plan: tasks by due date in free time, after travelling home, never overlapping", () => {
  const blocks = basicPlan(
    [monday],
    [
      { id: 1, title: "Edit reel", due: "2026-11-03", estimateMin: 60, priority: 2 },
      { id: 2, title: "Carousel draft", due: null, estimateMin: 30, priority: 1 },
    ],
    opts,
  );
  assert.equal(blocks[0].title, "Edit reel");
  assert.equal(blocks[0].start, "12:00"); // a 60-min task can't fit before leaving at 09:30; meeting ends 11:30 + 30 min home
  assert.ok(validateBlocks(blocks, [monday], opts).length === blocks.length);
  assert.ok(blocks.every((b) => b.kind === "task"));
});

test("nothing before the day starts; blocks during a meeting or without travel time are dropped", () => {
  const early = [{ date: "2026-11-02", start: "08:00", end: "08:45", title: "x", kind: "task" as const, taskId: null, reason: "" }];
  assert.equal(validateBlocks(early, [monday], opts).length, 0);
  const during = [{ date: "2026-11-02", start: "10:15", end: "10:45", title: "x", kind: "task" as const, taskId: null, reason: "" }];
  assert.equal(validateBlocks(during, [monday], opts).length, 0);
  const noTravel = [{ date: "2026-11-02", start: "11:30", end: "12:00", title: "x", kind: "task" as const, taskId: null, reason: "" }];
  assert.equal(validateBlocks(noTravel, [monday], opts).length, 0); // needs 30 min to get home from the office
});

test("extractJson reads a pasted Claude reply", () => {
  const reply = 'Here are the edits.\n\n```json\n{ "summary": "Shorter hook", "hook": "Did you know…" }\n```\nHope it helps!';
  assert.deepEqual(extractJson(reply), { summary: "Shorter hook", hook: "Did you know…" });
  assert.deepEqual(extractJson('{"summary":"x"}'), { summary: "x" });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson("```json\n{broken\n```"), null);
});

const table = { "home>FIRU office": 30, "FIRU office>home": 30, "home>Studio": 20, "Studio>home": 20, "FIRU office>Studio": 15, "Studio>FIRU office": 15 };
const label = (p: string) => p;

test("travel lookup", () => {
  assert.equal(travelTime(table, "home", "home"), 0);
  assert.equal(travelTime(table, "FIRU office", "online"), 0);
  assert.equal(travelTime(table, "home", "Studio"), 20);
  assert.equal(travelTime(table, "Studio", "Somewhere new"), undefined);
});

test("two meetings with enough travel have no clash; too close do", () => {
  const ok = [
    { start: 600, end: 690, place: "FIRU office", title: "FIRU" },
    { start: 720, end: 780, place: "Studio", title: "Shoot" },
  ];
  assert.equal(fixedClashes(ok, table, label).length, 0);
  const tight = [ok[0], { start: 695, end: 760, place: "Studio", title: "Shoot" }];
  assert.match(fixedClashes(tight, table, label)[0].message, /Only 5 min between FIRU/);
});

test("planned work at home must leave travel before the next meeting; online happens where you are", () => {
  const fixed = [{ start: 720, end: 780, place: "Studio", title: "Shoot" }];
  assert.equal(fitsDay([...fixed, { start: 600, end: 690, place: "home", title: "Edit", planned: true }], table, 540, 1200), true);
  assert.equal(fitsDay([...fixed, { start: 600, end: 710, place: "home", title: "Edit", planned: true }], table, 540, 1200), false);
  const call = [{ start: 600, end: 660, place: "online", title: "Client call" }];
  assert.equal(fitsDay([...call, { start: 660, end: 720, place: "home", title: "Edit", planned: true }], table, 540, 1200), true);
});
