import { test } from "node:test";
import assert from "node:assert/strict";
import { freeSlots, schoolPeriods, toHHMM, weekdayOf, mondayOf, addDays } from "../src/lib/time.ts";
import { basicPlan, validateBlocks, type DayContext } from "../src/lib/planner.ts";

test("school periods: 50 min classes + 10 min breaks", () => {
  const p = schoolPeriods("07:30", 7, 50, 10);
  assert.equal(toHHMM(p[0].start), "07:30");
  assert.equal(toHHMM(p[0].end), "08:20");
  assert.equal(toHHMM(p[6].end), "14:20"); // Wednesday, 7 classes
  const mon = schoolPeriods("08:30", 5, 50, 10);
  assert.equal(toHHMM(mon[4].end), "13:20");
});

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

const testTravel = { "school>home": 30, "home>school": 30, "school>gym": 5, "gym>home": 90, "home>gym": 30 };
const monday: DayContext = {
  date: "2026-11-02",
  weekday: 1,
  busy: [{ start: 510, end: 800, title: "School", kind: "school", place: "school" }],
  schoolEnd: 800,
  study: { subject: "Physics", sessionDate: "2026-11-03", sessionWeekday: 2 },
  gym: { title: "Push", durationMin: 90 },
};
const opts = { dayStart: "07:00", dayEnd: "22:30", freeDayStart: "10:00", travel: testTravel };

test("days without school: nothing before 10:00", () => {
  const saturday: DayContext = { date: "2026-11-07", weekday: 6, busy: [], schoolEnd: null, study: null, gym: { title: "Pull", durationMin: 75 } };
  const [gym] = basicPlan([saturday], [], opts);
  assert.equal(gym.start, "10:30"); // 10:00 at home + 30 min to the gym
  const early = [{ date: "2026-11-07", start: "08:00", end: "09:00", title: "x", kind: "study" as const, taskId: null, reason: "" }];
  assert.equal(validateBlocks(early, [saturday], opts).length, 0);
});

test("basic plan: gym after school travel, study after getting home, never overlapping", () => {
  const blocks = basicPlan([monday], [{ id: 1, title: "Edit reel", due: "2026-11-03", estimateMin: 60, priority: 2 }], opts);
  assert.equal(blocks[0].kind, "gym");
  assert.equal(blocks[0].start, "13:25"); // 13:20 + 5 min school → gym
  assert.equal(blocks[1].kind, "study");
  assert.equal(blocks[1].start, "16:25"); // gym ends 14:55 + 90 min shower and travel home
  assert.equal(validateBlocks(blocks, [monday], opts).length, blocks.length);
});

test("validateBlocks drops blocks during school or without travel time", () => {
  const during = [{ date: "2026-11-02", start: "09:00", end: "10:00", title: "x", kind: "task" as const, taskId: null, reason: "" }];
  assert.equal(validateBlocks(during, [monday], opts).length, 0);
  const noTravel = [{ date: "2026-11-02", start: "13:20", end: "14:20", title: "x", kind: "task" as const, taskId: null, reason: "" }];
  assert.equal(validateBlocks(noTravel, [monday], opts).length, 0); // needs 30 min to get home
});

import { parseExercises, formatExercises } from "../src/lib/gym.ts";

test("exercise parsing round-trips", () => {
  const list = parseExercises("Squat × 3\nWalking lunges x 2\nPlank (3 variations) 3\nDips");
  assert.deepEqual(list, [
    { name: "Squat", sets: 3 },
    { name: "Walking lunges", sets: 2 },
    { name: "Plank (3 variations)", sets: 3 },
    { name: "Dips", sets: 3 },
  ]);
  assert.deepEqual(parseExercises(formatExercises(list)), list);
});

import { extractJson } from "../src/lib/ai/extract-json.ts";

test("extractJson reads a pasted Claude reply", () => {
  const reply = 'Here are the edits.\n\n```json\n{ "summary": "Shorter hook", "hook": "Did you know…" }\n```\nHope it helps!';
  assert.deepEqual(extractJson(reply), { summary: "Shorter hook", hook: "Did you know…" });
  assert.deepEqual(extractJson('{"summary":"x"}'), { summary: "x" });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson("```json\n{broken\n```"), null);
});

import { nextSessionAfter, nextWeekday, occursOn } from "../src/lib/tutoring.ts";

const chemistry = { id: 3, subject: "Chemistry", weekday: 5, start: "15:00", end: "17:00", everyWeeks: 2, startDate: "2026-11-06" };
const physics = { id: 2, subject: "Physics", weekday: 2, start: "16:00", end: "18:00", everyWeeks: 1, startDate: "2026-11-03" };

test("every-other-week tutoring", () => {
  assert.equal(occursOn(chemistry, "2026-11-06"), true);
  assert.equal(occursOn(chemistry, "2026-11-13"), false);
  assert.equal(occursOn(chemistry, "2026-11-20"), true);
  assert.equal(occursOn(chemistry, "2026-10-30"), false); // before the first session
  assert.equal(occursOn(physics, "2026-11-10"), true);
});

test("next weekday and next session", () => {
  assert.equal(nextWeekday(1, "2026-11-03"), "2026-11-09");
  assert.equal(nextWeekday(2, "2026-11-03"), "2026-11-03");
  assert.deepEqual(nextSessionAfter([chemistry, physics], "2026-11-03")?.date, "2026-11-06");
  assert.deepEqual(nextSessionAfter([chemistry, physics], "2026-11-06")?.session.subject, "Physics");
});

import { fitsDay, fixedClashes, travelTime } from "../src/lib/travel.ts";

const table = {
  "school>gym": 5, "gym>Coding club": 60, "school>home": 30, "home>school": 30, "home>Coding club": 30,
  "Coding club>home": 30, "home>gym": 30, "gym>home": 90, "gym>online": 15,
};
const label = (p: string) => p;

test("travel lookup", () => {
  assert.equal(travelTime(table, "home", "home"), 0);
  assert.equal(travelTime(table, "gym", "online"), 15);
  assert.equal(travelTime(table, "school", "online"), 0);
  assert.equal(travelTime(table, "gym", "Physics tutoring"), undefined);
});

test("Monday: school, gym 13:25, coding club 16:00 has no clash; gym ending later does", () => {
  const ok = [
    { start: 510, end: 800, place: "school", title: "School" },
    { start: 805, end: 895, place: "gym", title: "Gym" },
    { start: 960, end: 1080, place: "Coding club", title: "Coding" },
  ];
  assert.equal(fixedClashes(ok, table, label).length, 0);
  const tight = [...ok.slice(0, 1), { start: 820, end: 910, place: "gym", title: "Gym" }, ok[2]];
  assert.match(fixedClashes(tight, table, label)[0].message, /Only 50 min between Gym/);
});

test("planned study at home must leave travel before Coding club", () => {
  const fixed = [
    { start: 510, end: 800, place: "school", title: "School" },
    { start: 960, end: 1080, place: "Coding club", title: "Coding" },
  ];
  // home study 14:00-15:30 leaves 30 min to reach Info at 16:00: fits
  assert.equal(fitsDay([...fixed, { start: 840, end: 930, place: "home", title: "Study", planned: true }], table, 420, 1350), true);
  // 14:00-15:45 leaves only 15 min: doesn't fit
  assert.equal(fitsDay([...fixed, { start: 840, end: 945, place: "home", title: "Study", planned: true }], table, 420, 1350), false);
  // straight after school with no travel home: doesn't fit
  assert.equal(fitsDay([...fixed, { start: 800, end: 860, place: "home", title: "Study", planned: true }], table, 420, 1350), false);
});

test("online session happens where you are", () => {
  const fri = [
    { start: 510, end: 860, place: "school", title: "School" },
    { start: 900, end: 1020, place: "online", title: "Chemistry" },
  ];
  // gym right after an online session, still at school area: school>gym = 5
  assert.equal(fitsDay([...fri, { start: 1025, end: 1085, place: "gym", title: "Gym", planned: true }], table, 420, 1350), true);
  assert.equal(fitsDay([...fri, { start: 1021, end: 1081, place: "gym", title: "Gym", planned: true }], table, 420, 1350), false);
});
