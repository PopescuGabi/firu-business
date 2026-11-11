// Pure: reading the Business Brain's leads.csv into lead rows (no server imports, so it is easy to test).
import type { LeadStatus } from "./db/schema";

/** RFC 4180 CSV: quoted fields may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim()));
}

export type LeadInput = {
  business: string;
  niche: string;
  city: string;
  channel: string;
  contact: string;
  why: string;
  score: number;
  status: LeadStatus;
  demoUrl: string | null;
  notes: string;
  foundOn: string | null;
};

/** Where a lead stands, from the CSV's outreach columns. A drafted message is not "sent" until Gabi sends it. */
export function statusFrom(r: Record<string, string>): LeadStatus {
  const outcome = (r.outcome ?? "").toLowerCase();
  if (/^(won|câștigat|semnat)/.test(outcome)) return "won";
  if (/^(lost|pierdut|refuzat|refuz|nu\b)/.test(outcome)) return "lost";
  if (/^(meeting|întâlnire|call|apel)/.test(outcome)) return "meeting";
  if ((r.reply ?? "").trim()) return "replied";
  if ((r.sent_date ?? "").trim()) return "sent";
  if ((r.message_sent ?? "").trim()) return "drafted";
  return "new";
}

export function leadsFromCsv(text: string): LeadInput[] {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase());
  if (!keys.includes("business")) throw new Error("The file needs a “business” column (the Business Brain's leads.csv).");
  const seen = new Set<string>();
  const out: LeadInput[] = [];
  for (const cells of body) {
    const r = Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()]));
    const business = r.business?.slice(0, 200);
    if (!business || seen.has(business.toLowerCase())) continue;
    seen.add(business.toLowerCase());
    const notes = r.notes ?? "";
    const demo = `${notes} ${r.why_picked ?? ""}`.match(/https?:\/\/[^\s,;)]+vercel\.app[^\s,;)]*/)?.[0].replace(/[.:]+$/, "") ?? null;
    out.push({
      business,
      niche: r.niche ?? "",
      city: r.city ?? "",
      channel: r.contact_channel ?? "",
      contact: (r.contact ?? "").slice(0, 300),
      why: (r.why_picked ?? "").slice(0, 2000),
      score: Math.max(0, Math.min(5, Number.parseInt(r.score_1to5 ?? "", 10) || 0)),
      status: statusFrom(r),
      demoUrl: demo,
      notes: notes.slice(0, 4000),
      foundOn: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") ? r.date : null,
    });
  }
  return out;
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  drafted: "Message drafted",
  sent: "Sent",
  replied: "Replied",
  meeting: "Meeting",
  won: "Won",
  lost: "Lost",
};
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: "var(--label-2)",
  drafted: "var(--orange)",
  sent: "var(--accent)",
  replied: "var(--purple)",
  meeting: "var(--teal)",
  won: "var(--green)",
  lost: "var(--label-3)",
};
