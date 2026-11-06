import { test } from "node:test";
import assert from "node:assert/strict";
import { chartData, checkSpec, coerceValue, computeStat, parsePageDraft, slugKey, type Spec } from "../src/lib/custom-pages.ts";
import { costUsd, monthStart } from "../src/lib/ai/allowance.ts";
import { tidyProposal } from "../src/lib/ai/setup.ts";

const shoots = {
  key: "shoots",
  name: "Shoots",
  titleField: "couple",
  fields: [
    { key: "couple", label: "Couple", type: "text" },
    { key: "date", label: "Date", type: "date" },
    { key: "price", label: "Price", type: "money", unit: "lei" },
    { key: "status", label: "Status", type: "select", options: ["Inquiry", "Booked", "Delivered"] },
    { key: "deposit", label: "Deposit paid", type: "checkbox" },
  ],
};
const draft = (blocks: unknown[], collections: unknown[] = [shoots]) => ({ title: "Shoots", icon: "camera", color: "#0A84FF", description: "", spec: { collections, blocks } });

test("a good photographer page passes as is", () => {
  const { draft: d, problems } = parsePageDraft(
    draft([
      { type: "board", id: "pipeline", title: "Pipeline", collection: "shoots", groupBy: "status" },
      { type: "upcoming", id: "next", title: "Next shoots", collection: "shoots", dateField: "date", home: true },
      { type: "stats", id: "money", title: "This month", collection: "shoots", stats: [{ label: "Income", op: "sum", field: "price", period: "month" }] },
      { type: "chart", id: "chart", title: "Income", collection: "shoots", op: "sum", field: "price", by: "month", dateField: "date" },
      { type: "notes", id: "notes", title: "Notes" },
    ]),
  );
  assert.deepEqual(problems, []);
  assert.equal(d?.spec.blocks.length, 5);
});

test("broken blocks are dropped with a reason, the rest is kept", () => {
  const { draft: d, problems } = parsePageDraft(
    draft([
      { type: "board", id: "a", title: "Board", collection: "shoots", groupBy: "couple" }, // not a select field
      { type: "checklist", id: "b", title: "List", collection: "shoots", doneField: "status" }, // not a checkbox
      { type: "table", id: "c", title: "Table", collection: "nope" }, // no such collection
      { type: "stats", id: "d", title: "Stats", collection: "shoots", stats: [{ label: "x", op: "sum", field: "couple" }] }, // sum of text
      { type: "cards", id: "e", title: "Cards", collection: "shoots" },
    ]),
  );
  assert.deepEqual(d?.spec.blocks.map((b) => b.id), ["e"]);
  assert.equal(problems.length, 4);
});

test("nothing usable → no page; limits and unknown block types are rejected", () => {
  assert.equal(parsePageDraft(draft([{ type: "board", id: "a", title: "B", collection: "x", groupBy: "y" }])).draft, null);
  assert.equal(parsePageDraft(draft([{ type: "script", id: "a", title: "Run code" }])).draft, null);
  const many = Array.from({ length: 11 }, (_, i) => ({ type: "notes", id: `n${i}`, title: "N" }));
  assert.equal(parsePageDraft(draft(many)).draft, null);
});

test("keys are made safe, the title field is fixed, select fields without options become text", () => {
  assert.equal(slugKey("Client name!"), "client_name");
  const { spec } = checkSpec({
    collections: [{ key: "jobs", name: "Jobs", titleField: "when", fields: [{ key: "when", label: "When", type: "date" }, { key: "kind", label: "Kind", type: "select" }] }],
    blocks: [{ type: "cards", id: "c", title: "Jobs", collection: "jobs" }],
  } as Spec);
  const c = spec.collections[0];
  assert.equal(c.titleField, "kind");
  assert.equal(c.fields.find((f) => f.key === "kind")?.type, "text");
});

test("form values are coerced to the field type", () => {
  const f = (type: string, extra = {}) => ({ key: "x", label: "X", type, ...extra }) as Parameters<typeof coerceValue>[0];
  assert.equal(coerceValue(f("money"), "1.250,5".replace(".", "")), 1250.5);
  assert.equal(coerceValue(f("number"), "abc"), null);
  assert.equal(coerceValue(f("rating"), "9"), 5);
  assert.equal(coerceValue(f("date"), "2026-11-06"), "2026-11-06");
  assert.equal(coerceValue(f("date"), "06/11/2026"), null);
  assert.equal(coerceValue(f("select", { options: ["A"] }), "B"), null);
  assert.equal(coerceValue(f("url"), "javascript:alert(1)"), null);
  assert.equal(coerceValue(f("checkbox"), "on"), true);
});

test("stats and charts", () => {
  const c = parsePageDraft(draft([{ type: "cards", id: "c", title: "C", collection: "shoots" }])).draft!.spec.collections[0];
  const items = [
    { couple: "A", date: "2026-11-02", price: 3000, status: "Booked" },
    { couple: "B", date: "2026-11-20", price: 4000, status: "Delivered" },
    { couple: "C", date: "2026-10-10", price: 2500, status: "Delivered" },
  ];
  assert.equal(computeStat(c, items, { label: "", op: "sum", field: "price", period: "month" }, "2026-11-06"), 7000);
  assert.equal(computeStat(c, items, { label: "", op: "count", period: "all", where: { field: "status", value: "Delivered" } }, "2026-11-06"), 2);
  const byStatus = chartData(c, items, { type: "chart", id: "x", title: "", collection: "shoots", op: "count", by: "status" }, "2026-11-06");
  assert.deepEqual(byStatus.values, [0, 1, 2]);
  const byMonth = chartData(c, items, { type: "chart", id: "x", title: "", collection: "shoots", op: "sum", field: "price", by: "month", dateField: "date" }, "2026-11-06");
  assert.deepEqual(byMonth.values.slice(-2), [2500, 7000]);
});

test("AI allowance: cost per model, month start", () => {
  assert.equal(costUsd([{ model: "claude-sonnet-5-5", input: 1_000_000, output: 100_000 }]), 3);
  assert.equal(costUsd([{ model: "unknown", input: 1_000_000, output: 0 }]), 4, "unknown models priced as Opus");
  assert.equal(monthStart(new Date("2026-11-06T15:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
});

test("setup proposal: unknown sections and broken pages are dropped", () => {
  const p = tidyProposal({
    summary: "ok",
    modules: ["clients", "portfolio", "hacking"],
    pages: [draft([{ type: "cards", id: "c", title: "Shoots", collection: "shoots" }]), { title: "Bad", spec: {} }],
  });
  assert.deepEqual(p.modules, ["clients", "portfolio"]);
  assert.equal(p.pages.length, 1);
  assert.ok(p.dropped.length >= 1);
  assert.deepEqual(tidyProposal("garbage"), { summary: "", modules: [], pages: [], dropped: [] });
});
