import { test } from "node:test";
import assert from "node:assert/strict";
import { leadsFromCsv, parseCsv, statusFrom } from "../src/lib/leads.ts";

test("parseCsv handles quotes, doubled quotes, commas, CRLF and line breaks inside fields", () => {
  const rows = parseCsv('a,b,c\r\n1,"x, y","say ""hi""\nline two"\r\n\r\n');
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "x, y", 'say "hi"\nline two'],
  ]);
});

test("leadsFromCsv maps the Business Brain columns, finds the demo link and dedupes by business", () => {
  const csv = [
    "date,business,niche,city,contact_channel,contact,why_picked,score_1to5,message_sent,sent_date,reply,outcome,notes",
    '2026-11-10,Clinica A,clinică,Craiova,email,a@x.ro,No booking,4,"Bună ziua,\n…",,,,"NOT sent. Demo: https://a-demo.vercel.app. Brief: x"',
    "2026-11-10,Clinica B,clinică,Craiova,,,Fine site,9,,,,,Skip",
    "2026-11-10,clinica a,dup,,,,,1,,,,,",
  ].join("\r\n");
  const leads = leadsFromCsv(csv);
  assert.equal(leads.length, 2);
  assert.equal(leads[0].status, "drafted");
  assert.equal(leads[0].demoUrl, "https://a-demo.vercel.app");
  assert.equal(leads[0].foundOn, "2026-11-10");
  assert.equal(leads[1].score, 5, "scores are clamped to 1–5");
  assert.equal(leads[1].demoUrl, null);
});

test("statusFrom: a drafted message is not 'sent' until it has a send date", () => {
  assert.equal(statusFrom({ message_sent: "text" }), "drafted");
  assert.equal(statusFrom({ message_sent: "text", sent_date: "2026-11-12" }), "sent");
  assert.equal(statusFrom({ reply: "Da" }), "replied");
  assert.equal(statusFrom({ outcome: "won" }), "won");
  assert.equal(statusFrom({ outcome: "nu a răspuns încă" }), "lost");
  assert.equal(statusFrom({ outcome: "meeting on Friday" }), "meeting");
  assert.equal(statusFrom({}), "new");
});

test("leadsFromCsv rejects files without a business column", () => {
  assert.throws(() => leadsFromCsv("name,city\nx,y"), /business/);
});
