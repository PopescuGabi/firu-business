import { test } from "node:test";
import assert from "node:assert/strict";
import { pickHubCalendar } from "../src/lib/brand.ts";
import { buildDesired, changeFromRemote, hasMark, MARK, sameSignature, signature, type HubData } from "../src/lib/calendar-sync/model.ts";

// Google echoes local times with the calendar's offset; the local part is what matters here.
const toLocal = (iso: string) => ({ date: iso.slice(0, 10), hm: iso.slice(11, 16) });

const hub: HubData = {
  timezone: "Europe/Bucharest",
  today: "2026-11-04",
  blocks: [
    { id: 1, date: "2026-11-05", start: "16:00", end: "17:00", title: "Edit FIRU reel", reason: "Due Friday", status: "accepted" },
    { id: 2, date: "2026-11-05", start: "18:00", end: "19:00", title: "Maybe", reason: "", status: "proposed" },
  ],
  tasks: [
    { id: 3, title: "Edit reel", notes: "", due: "2026-11-07", done: false },
    { id: 4, title: "Done one", notes: "", due: "2026-11-07", done: true },
    { id: 5, title: "No date", notes: "", due: null, done: false },
  ],
};

test("builds accepted blocks and open due dates only (nothing for school, gym or tutoring any more)", () => {
  const d = buildDesired(hub);
  assert.deepEqual(d.map((e) => e.key).sort(), ["block:1", "task:3"]);
  const block = d.find((e) => e.key === "block:1")!;
  assert.equal(block.start.dateTime, "2026-11-05T16:00:00");
  assert.equal(block.end.dateTime, "2026-11-05T17:00:00");
  assert.deepEqual(d.find((e) => e.key === "task:3")!.end, { date: "2026-11-08" });
});

test("unchanged events match their signature; edits don't", () => {
  const block = buildDesired(hub).find((e) => e.key === "block:1")!;
  assert.ok(sameSignature(signature(block, toLocal), signature({ ...block }, toLocal)));
  const moved = { ...block, start: { dateTime: "2026-11-05T16:30:00+02:00" }, end: { dateTime: "2026-11-05T17:30:00+02:00" } };
  assert.ok(!sameSignature(signature(block, toLocal), signature(moved, toLocal)));
});

test("phone edits map back to blocks and tasks; old school / gym / tutoring keys are ignored", () => {
  const moved = { summary: "Edit FIRU reel v2", start: { dateTime: "2026-11-05T16:30:00+02:00" }, end: { dateTime: "2026-11-05T17:30:00+02:00" } };
  assert.deepEqual(changeFromRemote("block:1", moved, toLocal), { kind: "block", id: 1, date: "2026-11-05", start: "16:30", end: "17:30", title: "Edit FIRU reel v2" });
  assert.deepEqual(changeFromRemote("task:3", { summary: "Due: Edit reel v2", start: { date: "2026-11-09" }, end: { date: "2026-11-10" } }, toLocal), {
    kind: "task",
    id: 3,
    due: "2026-11-09",
    title: "Edit reel v2",
  });
  for (const key of ["class:1:0", "gym:6", "tutoring:7"]) assert.equal(changeFromRemote(key, moved, toLocal), null, key);
});

test("after the rename: the new calendar wins, the old one still works, old sync notes are still ours", () => {
  assert.equal(pickHubCalendar([{ name: "Work" }, { name: "Personal Hub " }])?.name, "Personal Hub ");
  assert.equal(pickHubCalendar([{ name: "Personal Hub" }, { name: "firu business" }])?.name, "firu business");
  assert.equal(pickHubCalendar([{ name: "Work" }]), null);
  assert.equal(MARK, "Synced from FIRU Business.");
  assert.ok(hasMark("Due Friday\n\nSynced from Personal Hub."));
  assert.ok(hasMark(`Notes\n\n${MARK}`));
  assert.ok(!hasMark("My own event"));
  assert.ok(!hasMark(null));
});
