import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CarouselTheme, Slide } from "../db/schema";
import { BRAIN_PROMPT } from "../reels-brain/prompt";

export const reelProposal = z.object({
  summary: z.string(),
  title: z.string().optional(),
  hook: z.string().optional(),
  script: z.string().optional(),
  caption: z.string().optional(),
  notes: z.string().optional(),
});
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const carouselProposal = z.object({
  summary: z.string(),
  title: z.string().optional(),
  caption: z.string().optional(),
  slides: z
    .array(z.object({ heading: z.string(), body: z.string(), note: z.string().default("") }))
    .max(20)
    .optional(),
  theme: z
    .object({
      background: hex.optional(),
      foreground: hex.optional(),
      accent: hex.optional(),
      font: z.enum(["sans", "serif", "rounded"]).optional(),
      align: z.enum(["left", "center"]).optional(),
    })
    .optional(),
});
const str = (description: string) => ({ type: "string", description });

export const reelTool: Anthropic.Beta.BetaTool = {
  name: "propose_reel_edits",
  description:
    "Propose new text for one or more fields of the reel. Only include fields you are changing, with their complete new text. The user reviews the proposal and applies it with one click.",
  input_schema: {
    type: "object",
    properties: {
      summary: str("One short sentence describing what you changed."),
      title: str("New reel title."),
      hook: str("New hook (first 1-3 seconds)."),
      script: str("Complete new script."),
      caption: str("Complete new Instagram caption, including hashtags if wanted."),
      notes: str("New editing / production notes: timestamped cuts, B-roll, motion (each effect with its purpose), caption plan (style + why, emphasis words, position), music and loudness."),
    },
    required: ["summary"],
    additionalProperties: false,
  },
  eager_input_streaming: true,
};

export const carouselTool: Anthropic.Beta.BetaTool = {
  name: "propose_carousel_edits",
  description:
    "Propose changes to the carousel. When changing slides, send the COMPLETE new list of slides in order (it replaces the current list). Only include the other fields if you change them. The user reviews and applies it with one click.",
  input_schema: {
    type: "object",
    properties: {
      summary: str("One short sentence describing what you changed."),
      title: str("New carousel title."),
      caption: str("Complete new Instagram caption."),
      slides: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          properties: {
            heading: str("Slide headline (short)."),
            body: str("Slide body text."),
            note: str("Design note for this slide (visual, image idea). Not shown on the slide."),
          },
          required: ["heading", "body", "note"],
          additionalProperties: false,
        },
      },
      theme: {
        type: "object",
        properties: {
          background: str("Hex colour like #0B0B0F"),
          foreground: str("Hex colour for text"),
          accent: str("Hex accent colour"),
          font: { type: "string", enum: ["sans", "serif", "rounded"] },
          align: { type: "string", enum: ["left", "center"] },
        },
        additionalProperties: false,
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
  eager_input_streaming: true,
};

export const EDITOR_SYSTEM = `You are the content editor built into the user's private workspace. You edit Instagram reels and carousels for their clients.

How to work:
- Follow the user's saved prompts below. They describe their style, structure and rules; they take priority over your own preferences.
- Write in the language the content is already in (use correct diacritics for that language). If there's no content yet, use the language the user writes to you in.
- When the user asks for a change, make it with the proposal tool instead of only describing it, and keep your chat reply short (one or two sentences). For questions or feedback requests, just answer.
- Only change what was asked. Keep everything else exactly as it is.`;

export function renderPrompts(list: { name: string; body: string }[]) {
  if (!list.length) return "";
  return `\n\n<saved_prompts>\n${list
    .map((p) => `<prompt name="${p.name.replace(/"/g, "'")}">\n${p.body}\n</prompt>`)
    .join("\n")}\n</saved_prompts>`;
}

export function renderReel(r: { title: string; status: string; hook: string; script: string; caption: string; notes: string }) {
  return `<current_reel>
<title>${r.title}</title>
<status>${r.status}</status>
<hook>${r.hook}</hook>
<script>${r.script}</script>
<caption>${r.caption}</caption>
<notes>${r.notes}</notes>
</current_reel>`;
}

export function renderCarousel(c: { title: string; caption: string; slides: Slide[]; theme: CarouselTheme }) {
  return `<current_carousel>
<title>${c.title}</title>
<caption>${c.caption}</caption>
<theme>${JSON.stringify(c.theme)}</theme>
<slides>
${c.slides.map((s, i) => `<slide n="${i + 1}"><heading>${s.heading}</heading><body>${s.body}</body><note>${s.note}</note></slide>`).join("\n")}
</slides>
</current_carousel>`;
}

const REEL_FORMAT = `{
  "summary": "One short sentence: what you changed",
  "title": "…", "hook": "…", "script": "…", "caption": "…", "notes": "…"
}`;
const CAROUSEL_FORMAT = `{
  "summary": "One short sentence: what you changed",
  "title": "…",
  "caption": "…",
  "slides": [{ "heading": "…", "body": "…", "note": "design note, not shown on the slide" }],
  "theme": { "background": "#RRGGBB", "foreground": "#RRGGBB", "accent": "#RRGGBB", "font": "sans | serif | rounded", "align": "left | center" }
}
"slides" is the COMPLETE new list in order (it replaces the current slides).`;

/** A self-contained prompt to paste into the Claude app (covered by a Claude subscription). */
export function buildClaudeAppPrompt(opts: {
  targetType: "reel" | "carousel";
  context: string;
  prompts: { name: string; body: string }[];
  request: string;
}) {
  return `You are the user's content editor for Instagram ${opts.targetType === "reel" ? "reels" : "carousels"}.

- Follow the user's saved prompts below. They describe their style, structure and rules, and take priority over your own preferences.
- Write in the language the content is already in (use correct diacritics for that language). If there's no content yet, use the language of the request.
- Only change what was asked. Keep everything else exactly as it is.${opts.targetType === "reel" ? BRAIN_PROMPT : ""}${renderPrompts(opts.prompts)}

${opts.context}

<request>
${opts.request}
</request>

How to answer: if the request asks for changes, write one short sentence, then ONE \`\`\`json code block and nothing after it. Include only the fields you change ("summary" is always required), with their complete new text:
${opts.targetType === "reel" ? REEL_FORMAT : CAROUSEL_FORMAT}

If it's a question or asks for feedback, just answer in plain text without JSON.`;
}
