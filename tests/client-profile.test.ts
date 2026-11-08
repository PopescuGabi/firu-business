import { test } from "node:test";
import assert from "node:assert/strict";
import { clientProfile, renderProfile } from "../src/lib/client-profile.ts";

test("client profile marks a missing profile so Claude asks or marks assumptions", () => {
  assert.match(renderProfile("Client", {}), /no profile yet/);
  assert.match(renderProfile("Client", null), /no profile yet/);
  const full = renderProfile('A "quoted" name', { audience: "Local patients", awareness: "solution", constraints: "Medical rules" });
  assert.match(full, /name="A 'quoted' name"/);
  assert.match(full, /<awareness>Solution-aware<\/awareness>/);
  assert.match(full, /<constraints>Medical rules<\/constraints>/);
});

test("invalid values in a stored profile fall back instead of throwing", () => {
  const p = clientProfile.parse({ awareness: "everyone", goal: "viral" });
  assert.equal(p.awareness, "");
  assert.equal(p.goal, "");
});
