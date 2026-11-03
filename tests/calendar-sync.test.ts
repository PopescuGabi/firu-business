import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDesired, changeFromRemote, sameSignature, signature, type HubData } from "../src/lib/calendar-sync/model.ts";

// Google echoes local times with the calendar's offset; the local part is what matters here.
const toLocal = (iso: string) => ({ date: iso.slice(0, 10), hm: iso.slice(11, 16) });

const hub: HubData = {
  timezone: "Europe/London",
  today: "2026-11-04", // a Wednesday
  schoolYearEnd: "2027-06-11",
  classMinutes: 50,
  breakMinutes: 10,
  schoolGymTravel: 5,
  schoolDays: [{ weekday: 1, startTime: "08:30" }],
  classes: [
    { weekday: 1, period: 0, subject: "Physics" },
    { weekday: 1, period: 1, subject: "Chemistry" },
  ],
  gym: [
    { weekday: 1, title: "Push", durationMin: 90, timing: "after_school", startTime: null, exercises: [{ name: "Squat", sets: 3 }] },
    { weekday: 3, title: "Pull", durationMin: 60, timing: "flexible", startTime: null, exercises: [] },
    { weekday: 6, title: "Legs", durationMin: 75, timing: "fixed", startTime: "12:00", exercises: [] },
  ],
  tutoring: [{ id: 7, subject: "Physics", weekday: 5, start: "15:00", end: "17:00", everyWeeks: 2, startDate: "2026-11-06", place: "online" }],
  blocks: [
    { id: 1, date: "2026-11-05", start: "16:00", end: "17:00", title: "Study", reason: "Prep", status: "accepted" },
    { id: 2, date: "2026-11-05", start: "18:00", end: "19:00", title: "Maybe", reason: "", status: "proposed" },
  ],
  tasks: [
    { id: 3, title: "Edit reel", notes: "", due: "2026-11-07", done: false },
    { id: 4, title: "Done one", notes: "", due: "2026-11-07", done: true },
    { id: 5, title: "No date", notes: "", due: null, done: false },
  ],
};

test("builds classes, fixed gym, tutoring, accepted blocks and due dates only", () => {
  const d = buildDesired(hub);
  const keys = d.map((e) => e.key).sort();
  assert.deepEqual(keys, ["block:1", "class:1:0", "class:1:1", "gym:1", "gym:6", "task:3", "tutoring:7"]);
  const chem = d.find((e) => e.key === "class:1:1")!;
  assert.equal(chem.start.dateTime, "2026-11-02T09:30:00"); // this week's Monday, 2nd class
  assert.deepEqual(chem.recurrence, ["RRULE:FREQ=WEEKLY;UNTIL=20270611T235959Z"]);
  const gym = d.find((e) => e.key === "gym:1")!;
  assert.equal(gym.start.dateTime, "2026-11-02T10:25:00"); // 08:30 + 2 classes + 5 min travel
  assert.equal(gym.end.dateTime, "2026-11-02T11:55:00");
  assert.deepEqual(d.find((e) => e.key === "tutoring:7")!.recurrence, ["RRULE:FREQ=WEEKLY;INTERVAL=2"]);
  assert.deepEqual(d.find((e) => e.key === "task:3")!.end, { date: "2026-11-08" });
});

test("a series anchored in another week still matches (no needless rewrites)", () => {
  const desired = buildDesired(hub).find((e) => e.key === "class:1:0")!;
  const fromLastMonth = { ...desired, start: { dateTime: "2026-10-05T08:30:00+01:00" }, end: { dateTime: "2026-10-05T09:20:00+01:00" } };
  assert.ok(sameSignature(signature(desired, toLocal), signature(fromLastMonth, toLocal)));
});

test("phone edits are detected and mapped back", () => {
  const desired = buildDesired(hub);
  const sat = desired.find((e) => e.key === "gym:6")!;
  const moved = { ...sat, start: { dateTime: "2026-11-07T12:30:00+00:00" }, end: { dateTime: "2026-11-07T13:30:00+00:00" } };
  assert.ok(!sameSignature(signature(sat, toLocal), signature(moved, toLocal)));
  assert.deepEqual(changeFromRemote("gym:6", moved, toLocal), {
    kind: "gym", weekday: 6, newWeekday: 6, title: "Legs", startTime: "12:30", durationMin: 60,
  });
  const tut = desired.find((e) => e.key === "tutoring:7")!;
  const weekly = { ...tut, recurrence: ["RRULE:FREQ=WEEKLY"], summary: "Tutoring · Biology" };
  assert.deepEqual(changeFromRemote("tutoring:7", weekly, toLocal), {
    kind: "tutoring", id: 7, subject: "Biology", weekday: 5, start: "15:00", end: "17:00", everyWeeks: 1, startDate: "2026-11-06",
  });
  assert.deepEqual(changeFromRemote("task:3", { summary: "Due: Edit reel v2", start: { date: "2026-11-09" }, end: { date: "2026-11-10" } }, toLocal), {
    kind: "task", id: 3, due: "2026-11-09", title: "Edit reel v2",
  });
});

test("every-other-week tutoring moved by a week is a real change", () => {
  const tut = buildDesired(hub).find((e) => e.key === "tutoring:7")!;
  const shifted = { ...tut, start: { dateTime: "2026-11-13T15:00:00" }, end: { dateTime: "2026-11-13T17:00:00" } };
  assert.ok(!sameSignature(signature(tut, toLocal), signature(shifted, toLocal)));
});
