import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePageDraft } from "../src/lib/custom-pages.ts";
import { TAB_STARTERS } from "../src/lib/tab-starters.ts";
import { defaultTabs, featuresForTabs, moveTab, tabsFor, toggleTab } from "../src/lib/client-tabs.ts";

test("a client never customised gets tabs from its tools", () => {
  assert.deepEqual(defaultTabs(["instagram", "content", "finance"]), ["overview", "instagram", "content", "finance", "profile", "dashboard"]);
  assert.deepEqual(defaultTabs(["finance"]), ["overview", "finance"]);
  assert.deepEqual(tabsFor(null, ["app"], []), ["overview", "app", "dashboard"]);
});

test("a saved list is cleaned: Overview first, no unknown keys, deleted pages or switched-off tools", () => {
  const saved = ["files", "page:7", "overview", "instagram", "nope", "page:9", "files", "profile"];
  assert.deepEqual(tabsFor(saved, ["finance"], [7]), ["overview", "files", "page:7", "finance"]);
  // A tool switched on in the client form shows up even if the list doesn't have it yet.
  assert.deepEqual(tabsFor(["overview", "tasks"], ["instagram"], []), ["overview", "tasks", "instagram"]);
});

test("toggling and moving keep Overview first", () => {
  assert.deepEqual(toggleTab(["overview", "tasks"], "files", true), ["overview", "tasks", "files"]);
  assert.deepEqual(toggleTab(["overview", "tasks"], "overview", false), ["overview", "tasks"]);
  assert.deepEqual(toggleTab(["overview", "tasks", "files"], "tasks", false), ["overview", "files"]);
  assert.deepEqual(moveTab(["overview", "a", "b", "c"], "c", -1), ["overview", "a", "c", "b"]);
  assert.deepEqual(moveTab(["overview", "a", "b"], "a", -1), ["overview", "a", "b"]);
  assert.deepEqual(moveTab(["overview", "a", "b"], "overview", 1), ["overview", "a", "b"]);
});

test("tools follow the tool tabs, other features stay", () => {
  assert.deepEqual(featuresForTabs(["overview", "content", "tasks"], ["instagram", "content", "something"]), ["something", "content"]);
});

test("every starter tab is a valid page", () => {
  for (const [key, raw] of Object.entries(TAB_STARTERS)) {
    const { draft, problems } = parsePageDraft(raw);
    assert.ok(draft, `${key}: ${problems.join("; ")}`);
    assert.deepEqual(problems, [], key);
  }
});
