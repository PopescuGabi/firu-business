// The AI video spec: what Opus writes from a client's input, and what the in-browser renderer plays and exports.
// Safe to import on client and server. Every field has a default so a partial AI reply still renders;
// `lintSpec` then applies the Reels Brain rules the template can't enforce by layout alone.
import { z } from "zod";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const SCENE_KINDS = ["hook", "statement", "list", "steps", "stat", "quote", "compare", "media", "cta"] as const;
export const TRANSITIONS = ["push", "lift", "fade", "zoom", "cut"] as const;
export const SFX = ["none", "whoosh", "whoosh-in", "pop", "tick", "shimmer", "hit", "tap"] as const;
export const MOODS = ["none", "calm", "upbeat", "energetic"] as const;
export const FONTS = ["sans", "serif", "rounded", "mono"] as const;
export const LOOKS = ["clean", "bold", "soft", "dark"] as const;

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .catch("#2f7bff");
const str = (max: number) => z.string().max(max * 2).transform((s) => s.trim().slice(0, max)).catch("");

export const mediaRef = z.object({
  ref: str(80), // attachment id from the input list
  fit: z.enum(["cover", "contain"]).catch("cover"),
  move: z.enum(["in", "out", "left", "right", "none"]).catch("in"), // slow Ken Burns move with a purpose
  from: z.number().min(0).max(600).catch(0), // seconds into a video clip
});
export type MediaRef = z.infer<typeof mediaRef>;

export const scene = z.object({
  kind: z.enum(SCENE_KINDS).catch("statement"),
  duration: z.number().min(0.8).max(12).catch(2.5), // seconds; lintSpec raises it to the reading time
  title: str(90), // main on-screen line (hook / point). Keep ≤ 2 short lines.
  subtitle: str(140),
  emphasis: str(40), // one word or short phrase from the title to accent (by meaning)
  items: z.array(str(70)).max(5).catch([]), // list / steps / compare (compare: exactly 2)
  value: str(16), // stat value, only if it appears in the client's input
  label: str(60), // stat label / quote author / compare header
  media: mediaRef.nullable().catch(null),
  caption: str(160), // spoken line or supporting caption shown in the caption band
  transition: z.enum(TRANSITIONS).catch("push"), // how this scene enters
  sfx: z.enum(SFX).catch("none"),
});
export type Scene = z.infer<typeof scene>;

export const videoSpec = z.object({
  version: z.literal(1).catch(1),
  title: str(80),
  language: str(20),
  theme: z
    .object({
      look: z.enum(LOOKS).catch("clean"),
      accent: hex,
      accent2: hex,
      font: z.enum(FONTS).catch("sans"),
    })
    .catch({ look: "clean", accent: "#2f7bff", accent2: "#a35bea", font: "sans" }),
  music: z
    .object({ mood: z.enum(MOODS).catch("upbeat"), volume: z.number().min(0).max(1).catch(0.85) })
    .catch({ mood: "upbeat", volume: 0.85 }),
  handle: str(40), // shown on the CTA card, e.g. @studio
  scenes: z.array(scene).min(1).max(14).catch([]),
  postCaption: str(2200),
  hashtags: z.array(str(40)).max(5).catch([]),
  notes: str(1500), // the AI's reasoning: brain rules applied, open questions for Gabi
});
export type VideoSpec = z.infer<typeof videoSpec>;

/** Attachments the user picked for this video (kept in the browser; never uploaded by the video maker). */
export type Attachment = { id: string; name: string; kind: "video" | "image"; url: string; duration?: number; width?: number; height?: number; note?: string };

// ── Brain rules the renderer enforces ─────────────────────────────────────────────────────────
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
/** Reading time for on-screen text: ~3.2 words/s (≈ 17 cps, the brain's review flag) plus a 0.6 s settle. */
export const readingTime = (s: Scene) => {
  const w = words(s.title) + words(s.subtitle) * 0.8 + s.items.reduce((a, i) => a + words(i), 0) + words(s.caption) * 0.6 + (s.value ? 1 : 0);
  return Math.max(s.kind === "media" && !s.title ? 1.5 : 1.6, 0.6 + w / 3.2 + (s.items.length ? 0.3 * s.items.length : 0));
};

export type Lint = { level: "fix" | "warn"; scene?: number; text: string };

/** Applies the brain rules: fixes what can be fixed safely, warns about the rest. Returns a new spec. */
export function lintSpec(input: VideoSpec, sourceText: string, attachments: Attachment[]): { spec: VideoSpec; lints: Lint[] } {
  const lints: Lint[] = [];
  const spec: VideoSpec = structuredClone(input);
  const ids = new Set(attachments.map((a) => a.id));
  if (!spec.scenes.length) {
    lints.push({ level: "warn", text: "The AI returned no scenes." });
    return { spec, lints };
  }
  // Hook first (scripting A2): the first scene carries the promise and enters with no fade from black.
  if (spec.scenes[0].kind !== "hook") lints.push({ level: "warn", scene: 0, text: "The first scene isn't a hook. The promise should be readable from frame 0." });
  if (spec.scenes[0].transition !== "cut") {
    spec.scenes[0].transition = "cut";
    lints.push({ level: "fix", scene: 0, text: "The first scene now starts on a cut, so the subject is visible in frame 0." });
  }
  const hook = spec.scenes[0].title;
  if (hook.length > 60) lints.push({ level: "warn", scene: 0, text: `The hook is ${hook.length} characters. Aim for ≤ 2 short lines (about 50 characters).` });
  spec.scenes.forEach((s, i) => {
    // Holds of at least the reading time (motion: hold ≥ reading time).
    const need = Math.ceil(readingTime(s) * 10) / 10;
    if (s.duration < need) {
      lints.push({ level: "fix", scene: i, text: `Duration raised from ${s.duration.toFixed(1)} s to ${need.toFixed(1)} s so the text can be read.` });
      s.duration = need;
    }
    // Media must point at a real attachment.
    if (s.media && !ids.has(s.media.ref)) {
      lints.push({ level: s.kind === "media" ? "warn" : "fix", scene: i, text: `Media "${s.media.ref}" isn't attached, so it was removed.` });
      s.media = null;
      if (s.kind === "media") s.kind = "statement";
    }
    // No invented numbers (non-negotiable): a stat value must appear in the client's input.
    if (s.kind === "stat") {
      const digits = s.value.replace(/[^0-9.,]/g, "");
      if (!digits || !sourceText.includes(digits.replace(/[.,]$/, ""))) {
        lints.push({ level: "warn", scene: i, text: `The number "${s.value}" doesn't appear in the client input. Check it, or remove the stat.` });
      }
    }
    // Emphasis must be a word that is actually on screen (captions: one accent per chunk, by meaning).
    if (s.emphasis && !s.title.toLowerCase().includes(s.emphasis.toLowerCase())) s.emphasis = "";
    if (s.kind === "compare" && s.items.length !== 2) lints.push({ level: "warn", scene: i, text: "A compare scene needs exactly 2 items." });
  });
  // CTA only after the payoff, and only one (marketing: one readiness-appropriate CTA).
  const ctas = spec.scenes.map((s, i) => (s.kind === "cta" ? i : -1)).filter((i) => i >= 0);
  if (ctas.length > 1) lints.push({ level: "warn", text: `There are ${ctas.length} CTA scenes. Keep one, at the end.` });
  if (ctas.length && ctas[ctas.length - 1] !== spec.scenes.length - 1) lints.push({ level: "warn", text: "The CTA isn't the last scene." });
  const total = spec.scenes.reduce((a, s) => a + s.duration, 0);
  if (total > 90) lints.push({ level: "warn", text: `It runs ${total.toFixed(0)} s. Most client reels work better under 60 s. Shorts over 60 s need original audio (platforms E8).` });
  if (spec.hashtags.length > 5) spec.hashtags = spec.hashtags.slice(0, 5);
  return { spec, lints };
}

export const totalFrames = (spec: VideoSpec) => Math.max(FPS, Math.round(spec.scenes.reduce((a, s) => a + s.duration, 0) * FPS) + Math.round(0.6 * FPS));

export const emptySpec = (): VideoSpec => videoSpec.parse({ scenes: [] });

/** JSON shape description for the prompt (kept next to the schema so they never drift). */
export const SPEC_DOC = `{
  "version": 1,
  "title": "internal name",
  "language": "ro | en | …",
  "theme": { "look": "clean | bold | soft | dark", "accent": "#RRGGBB", "accent2": "#RRGGBB", "font": "sans | serif | rounded | mono" },
  "music": { "mood": "calm | upbeat | energetic | none", "volume": 0.85 },
  "handle": "@client (optional)",
  "scenes": [
    {
      "kind": "hook | statement | list | steps | stat | quote | compare | media | cta",
      "duration": 2.5,
      "title": "main line, max ~50 chars for the hook",
      "subtitle": "optional second line",
      "emphasis": "one word from the title to accent",
      "items": ["for list / steps (≤5), compare (exactly 2)"],
      "value": "stat value ONLY if it is in the input",
      "label": "stat label / quote author / compare header",
      "media": { "ref": "attachment id", "fit": "cover | contain", "move": "in | out | left | right | none", "from": 0 } or null,
      "caption": "optional caption-band line (what is said / the supporting line)",
      "transition": "push | lift | fade | zoom | cut",
      "sfx": "none | whoosh | whoosh-in | pop | tick | shimmer | hit | tap"
    }
  ],
  "postCaption": "Instagram caption: keyword first line, one CTA",
  "hashtags": ["max 5"],
  "notes": "which brain rules you applied, what you assumed, what Gabi should check"
}`;
