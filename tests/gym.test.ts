import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSplit, formatExercises, gymProposal, nextTarget, parseExercises, progressSeries } from "../src/lib/gym.ts";

test("parses exercises with and without target reps", () => {
  assert.deepEqual(parseExercises("Bench press × 3 × 8\nSquat 5x5\nPull-ups x 4\nPlank"), [
    { name: "Bench press", sets: 3, reps: 8 },
    { name: "Squat", sets: 5, reps: 5 },
    { name: "Pull-ups", sets: 4 },
    { name: "Plank", sets: 3 },
  ]);
  assert.equal(formatExercises([{ name: "Bench press", sets: 3, reps: 8 }, { name: "Dips", sets: 3 }]), "Bench press × 3 × 8\nDips × 3");
});

const bench = { name: "Bench press", sets: 3, reps: 10 };
const sets = (date: string, weight: number, reps: number[]) => reps.map((r, i) => ({ date, setNo: i + 1, weight, reps: r }));

test("first time: no target weight yet", () => {
  const t = nextTarget(bench, []);
  assert.equal(t.change, "start");
  assert.equal(t.reps, 10);
});

test("every set at the target reps → +2.5 kg", () => {
  const t = nextTarget(bench, [...sets("2026-10-28", 60, [8, 8, 7]), ...sets("2026-11-01", 60, [10, 10, 10])]);
  assert.deepEqual([t.change, t.weight, t.reps], ["kg", 62.5, 10]);
  assert.equal(t.last?.date, "2026-11-01");
});

test("a set short of the target → same weight, one more rep", () => {
  const t = nextTarget(bench, sets("2026-11-01", 62.5, [10, 10, 9]));
  assert.deepEqual([t.change, t.weight, t.reps], ["rep", 62.5, 10]);
  const early = nextTarget(bench, sets("2026-11-01", 62.5, [8, 7, 7]));
  assert.deepEqual([early.change, early.weight, early.reps], ["rep", 62.5, 8]);
});

test("fewer sets than planned never adds weight; bodyweight progresses by reps", () => {
  assert.equal(nextTarget(bench, sets("2026-11-01", 60, [12, 12])).change, "rep");
  const pullups = nextTarget({ name: "Pull-ups", sets: 3, reps: 8 }, sets("2026-11-01", 0, [8, 8, 8]));
  assert.deepEqual([pullups.change, pullups.weight, pullups.reps], ["rep", 0, 9]);
});

test("progress: heaviest set per session, oldest first", () => {
  const s = progressSeries([...sets("2026-11-01", 62.5, [10, 9]), ...sets("2026-10-28", 60, [10, 10]), { date: "2026-11-01", setNo: 3, weight: 65, reps: 5 }]);
  assert.deepEqual(
    s.map((p) => [p.date, p.top, p.reps]),
    [
      ["2026-10-28", 60, 10],
      ["2026-11-01", 65, 5],
    ],
  );
});

const day = (weekday: number, title: string, exercises = [{ name: "Squat", sets: 3 }]) => ({ weekday, title, durationMin: 60, timing: "flexible" as const, exercises });

test("coach proposals are checked before they can be applied", () => {
  assert.ok(gymProposal.safeParse({ summary: "ok", days: [day(1, "Legs")], remove: [3] }).success);
  assert.ok(!gymProposal.safeParse({ summary: "x", days: [day(1, "A"), day(1, "B")], remove: [] }).success, "same day twice");
  assert.ok(!gymProposal.safeParse({ summary: "x", days: [day(2, "A")], remove: [2] }).success, "changed and removed");
  assert.ok(!gymProposal.safeParse({ summary: "x", days: [day(8, "A")], remove: [] }).success, "weekday out of range");
  assert.ok(!gymProposal.safeParse({ summary: "x", days: [day(1, "A", [{ name: "Squat", sets: 12 }])], remove: [] }).success, "too many sets");
  assert.ok(!gymProposal.safeParse({ summary: "x", days: [{ ...day(1, "A"), timing: "fixed" }], remove: [] }).success, "fixed without a time");
  assert.ok(!gymProposal.safeParse({ summary: "x", days: [], remove: [] }).success, "nothing to change");
});

test("diff shows new, changed, unchanged and removed days", () => {
  const current = [
    { ...day(1, "Push", [{ name: "Bench press", sets: 3 }, { name: "Dips", sets: 3 }]), startTime: null },
    { ...day(3, "Pull"), startTime: null },
    { ...day(5, "Legs"), startTime: null },
  ];
  const changes = diffSplit(current, {
    days: [day(1, "Push", [{ name: "Bench press", sets: 4 }, { name: "Overhead press", sets: 3 }]), day(5, "Legs"), day(6, "Arms")],
    remove: [3],
  });
  assert.deepEqual(
    changes.map((c) => [c.weekday, c.kind]),
    [
      [1, "changed"],
      [3, "removed"],
      [5, "same"],
      [6, "new"],
    ],
  );
  const mon = changes[0];
  assert.ok(mon.kind === "changed");
  assert.deepEqual([mon.added, mon.dropped], [["Overhead press"], ["Dips"]]);
});
