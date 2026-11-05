// Shared shapes for the Reels Brain: a client profile (who the content is for) and a reel plan
// (diagnosis → caption plan → one experiment → review checks). Safe to import on client and server.
import { z } from "zod";

const t = (max: number) => z.string().max(max).default("");

export const AWARENESS = ["", "unaware", "problem", "solution", "product", "most"] as const;
export const OBJECTIVES = ["", "reach", "community", "authority", "leads", "sales"] as const;
export const CAPTION_STYLES = ["", "phrase", "highlight", "karaoke", "none"] as const;
export const TREATMENTS = ["", "speaking", "motion", "demo", "testimonial", "story", "montage", "tutorial", "hybrid"] as const;

export const clientProfile = z.object({
  audience: t(1000), // who, situation, moment
  awareness: z.enum(AWARENESS).catch(""),
  offer: t(1000),
  positioning: t(1000),
  voice: t(600), // tone, register (tu / dumneavoastră), words to avoid
  language: t(80),
  brand: t(1000), // colours, type, recurring devices
  platforms: t(300),
  goal: z.enum(OBJECTIVES).catch(""),
  constraints: t(2000), // legal / medical / consent / claims to avoid
  performance: t(2000), // observed results, with dates and where the numbers came from
});
export type ClientProfile = z.infer<typeof clientProfile>;
export const emptyProfile = (): ClientProfile => clientProfile.parse({});

export const reelPlan = z.object({
  objective: z.enum(OBJECTIVES).catch(""),
  awareness: z.enum(AWARENESS).catch(""),
  treatment: z.enum(TREATMENTS).catch(""),
  promise: t(600), // what the hook promises
  payoff: t(600), // what the viewer gets, and where (timestamp)
  proof: t(600),
  cta: t(400), // one CTA + its mechanism
  captionStyle: z.enum(CAPTION_STYLES).catch(""),
  captionWhy: t(400),
  emphasis: t(300), // comma-separated words that carry the meaning
  motion: t(1500), // keyword → visual state; holds
  audio: t(800),
  hypothesis: t(600),
  variable: t(200),
  metric: t(200),
  checks: z.record(z.string(), z.boolean()).default({}), // review checklist ids → done
});
export type ReelPlan = z.infer<typeof reelPlan>;
export const emptyPlan = (): ReelPlan => reelPlan.parse({});

export const AWARENESS_LABELS: Record<string, string> = {
  "": "—",
  unaware: "Unaware",
  problem: "Problem-aware",
  solution: "Solution-aware",
  product: "Product-aware",
  most: "Most aware",
};
export const OBJECTIVE_LABELS: Record<string, string> = {
  "": "—",
  reach: "Reach",
  community: "Community",
  authority: "Authority",
  leads: "Leads",
  sales: "Sales",
};
export const CAPTION_LABELS: Record<string, string> = {
  "": "—",
  phrase: "Phrase (calm, 1 accent)",
  highlight: "Word highlight (content words)",
  karaoke: "Karaoke pill",
  none: "None (music only → alt text)",
};
export const TREATMENT_LABELS: Record<string, string> = {
  "": "—",
  speaking: "Speaking reel",
  motion: "Motion-led explainer",
  demo: "Demo",
  testimonial: "Testimonial",
  story: "Story",
  montage: "Montage",
  tutorial: "Tutorial",
  hybrid: "Hybrid",
};
