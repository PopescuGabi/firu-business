import { test } from "node:test";
import assert from "node:assert/strict";
import { lintSpec, readingTime, totalFrames, videoSpec, type Attachment } from "../src/lib/video/spec.ts";

const att: Attachment[] = [{ id: "clip-1", name: "kitchen.mp4", kind: "video", url: "blob:x", duration: 12 }];

test("a partial AI reply still parses with safe defaults", () => {
  const s = videoSpec.parse({ scenes: [{ title: "Hi", kind: "nonsense", transition: "spin" }], theme: { accent: "red" } });
  assert.equal(s.scenes[0].kind, "statement");
  assert.equal(s.scenes[0].transition, "push");
  assert.equal(s.theme.accent, "#2f7bff");
  assert.equal(s.music.mood, "upbeat");
});

test("brain lint: frame-0 hook, reading time, real media, no invented numbers, one CTA last", () => {
  const raw = videoSpec.parse({
    scenes: [
      { kind: "hook", title: "Three dishes, one spring menu", transition: "fade", duration: 0.9 },
      { kind: "stat", title: "Off the first week", value: "40%", duration: 3 },
      { kind: "media", media: { ref: "clip-9" }, duration: 2 },
      { kind: "cta", title: "Book a table", duration: 2 },
      { kind: "statement", title: "After the CTA", duration: 2 },
    ],
  });
  const { spec, lints } = lintSpec(raw, "Spring menu, 15% off the first week", att);
  assert.equal(spec.scenes[0].transition, "cut"); // subject visible in frame 0
  assert.ok(spec.scenes[0].duration >= readingTime(spec.scenes[0]));
  assert.equal(spec.scenes[2].media, null); // unknown attachment removed
  assert.equal(spec.scenes[2].kind, "statement");
  assert.ok(lints.some((l) => l.text.includes('"40%"'))); // number not in the input
  assert.ok(lints.some((l) => l.text.includes("CTA isn't the last")));
  assert.equal(raw.scenes[0].transition, "fade"); // input not mutated
});

test("a stat that is in the input passes, and total length includes a short tail", () => {
  const raw = videoSpec.parse({ scenes: [{ kind: "hook", title: "Spring menu", duration: 2 }, { kind: "stat", value: "15%", label: "off", duration: 3 }] });
  const { spec, lints } = lintSpec(raw, "15% off the first week", att);
  assert.ok(!lints.some((l) => l.text.includes("doesn't appear")));
  assert.equal(totalFrames(spec), Math.round((spec.scenes[0].duration + spec.scenes[1].duration) * 30) + 18);
});
