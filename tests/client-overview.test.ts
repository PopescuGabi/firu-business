import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLayout } from "../src/lib/board.ts";
import { overviewCatalogue, overviewDefault } from "../src/lib/client-overview.ts";

test("a client's Overview offers tool tiles only for the tools it has, plus its own tabs", () => {
  const ids = overviewCatalogue(["instagram"], [{ id: 4, title: "Shoot notes" }]).map((w) => w.id);
  assert.ok(ids.includes("followers"));
  assert.ok(!ids.includes("money") && !ids.includes("content") && !ids.includes("app"));
  assert.ok(ids.includes("tasks") && ids.includes("files") && ids.includes("page:4"));
});

test("the starting board: tools first, then tasks, about and files; their dashboard only when there's something to share", () => {
  assert.deepEqual(overviewDefault(["instagram", "finance"]), ["followers", "money", "tasks", "about", "files", "dashboard"]);
  assert.deepEqual(overviewDefault(["finance"]), ["money", "tasks", "about", "files"]);
  assert.deepEqual(overviewDefault([]), ["tasks", "about", "files"]);
});

test("a saved board drops tiles for tools the client no longer has", () => {
  const saved = { computer: [{ i: "money", x: 0, y: 0, w: 4, h: 3 }, { i: "tasks", x: 4, y: 0, w: 8, h: 4 }], tablet: [], phone: [] };
  const layout = normalizeLayout(saved, overviewCatalogue(["instagram"], []), overviewDefault(["instagram"]));
  assert.deepEqual(layout.computer.map((it) => it.i), ["tasks"]);
});
