import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAIN_PROMPT, renderPlan, renderProfile } from "../src/lib/reels-brain/prompt.ts";
import { REVIEW, RULES } from "../src/lib/reels-brain/content.ts";
import { reelPlan } from "../src/lib/reels-brain/types.ts";

test("empty reel plan renders nothing (no noise in Claude's context)", () => {
  assert.equal(renderPlan({}), "");
  assert.equal(renderPlan(null), "");
});

test("reel plan renders labels, caption plan and the experiment", () => {
  const out = renderPlan({ objective: "leads", captionStyle: "phrase", captionWhy: "calm speaker", hypothesis: "Benefit-first lowers Skip Rate", variable: "first 3 s", metric: "Skip Rate" });
  assert.match(out, /<objective>Leads<\/objective>/);
  assert.match(out, /Phrase .* — calm speaker/);
  assert.match(out, /variable: first 3 s \| metric: Skip Rate/);
});

test("invalid enums in a stored plan fall back instead of throwing", () => {
  const p = reelPlan.parse({ objective: "viral", captionStyle: "bounce", checks: { frame0: true } });
  assert.equal(p.objective, "");
  assert.equal(p.captionStyle, "");
  assert.equal(p.checks.frame0, true);
});

test("client profile marks a missing profile so Claude asks or marks assumptions", () => {
  assert.match(renderProfile("Siloși", {}), /no profile yet/);
  const full = renderProfile('A "quoted" name', { audience: "Local patients", awareness: "solution", constraints: "CMR rules" });
  assert.match(full, /name="A 'quoted' name"/);
  assert.match(full, /<awareness>Solution-aware<\/awareness>/);
  assert.match(full, /<constraints>CMR rules<\/constraints>/);
});

test("brain prompt carries every rule group and the honesty rule", () => {
  for (const g of RULES) assert.ok(BRAIN_PROMPT.includes(`## ${g.title}`), g.title);
  assert.match(BRAIN_PROMPT, /Never invent numbers/);
});

test("review checklist ids are unique (they are saved per reel)", () => {
  const ids = REVIEW.flatMap((g) => g.items.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
});
