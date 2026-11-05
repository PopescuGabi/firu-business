// Turns the Reels Brain, a client profile and a reel plan into text for Claude.
import { RULES, CAPTION_STYLE_GUIDE } from "./content.ts";
import { AWARENESS_LABELS, CAPTION_LABELS, OBJECTIVE_LABELS, TREATMENT_LABELS, clientProfile, reelPlan, type ClientProfile, type ReelPlan } from "./types.ts";

/** The craft rules as compact text (sent once per request; cached with the system prompt). */
export const BRAIN_PROMPT = `\n\n<reels_brain>
These are the user's researched craft rules for short-form video. Apply them unless the user's request, saved prompts or the client profile say otherwise. Never invent numbers, results, testimonials, urgency or analytics; mark guesses as guesses.

${RULES.map((g) => `## ${g.title}\n${g.rules.map((r) => `- ${r.title}: ${r.body}`).join("\n")}`).join("\n\n")}

## Caption style by video
${CAPTION_STYLE_GUIDE.map((c) => `- ${c.style}: ${c.when}.`).join("\n")}

When you write or revise a reel:
- Hook: offer options that align visual + on-screen text + spoken line and are self-contained.
- Script: beats linked by „dar / așa că”; payoff before the CTA; one CTA with its mechanism.
- Editing notes: timestamped where possible; every effect with its purpose; a caption plan (style + why, emphasis words, position); audio (ducking, loudness).
- Post caption: searchable phrase on line 1, one CTA, ≤ 5 specific hashtags, plus an alt-text line for visual-only information.
</reels_brain>`;

const line = (label: string, v: string | undefined) => (v && v.trim() ? `<${label}>${v.trim()}</${label}>\n` : "");

export function renderProfile(name: string, raw: unknown) {
  const p: ClientProfile = clientProfile.parse(raw ?? {});
  const body =
    line("audience", p.audience) +
    line("awareness", p.awareness ? AWARENESS_LABELS[p.awareness] : "") +
    line("offer", p.offer) +
    line("positioning", p.positioning) +
    line("voice", p.voice) +
    line("language", p.language) +
    line("brand_system", p.brand) +
    line("platforms", p.platforms) +
    line("goal", p.goal ? OBJECTIVE_LABELS[p.goal] : "") +
    line("constraints", p.constraints) +
    line("observed_performance", p.performance);
  return `<client_profile name="${name.replace(/"/g, "'")}">\n${body || "(no profile yet — ask or mark assumptions)\n"}</client_profile>`;
}

export function renderPlan(raw: unknown) {
  const p: ReelPlan = reelPlan.parse(raw ?? {});
  const body =
    line("objective", p.objective ? OBJECTIVE_LABELS[p.objective] : "") +
    line("awareness", p.awareness ? AWARENESS_LABELS[p.awareness] : "") +
    line("treatment", p.treatment ? TREATMENT_LABELS[p.treatment] : "") +
    line("promise", p.promise) +
    line("payoff", p.payoff) +
    line("proof", p.proof) +
    line("cta", p.cta) +
    line("caption_style", p.captionStyle ? `${CAPTION_LABELS[p.captionStyle]}${p.captionWhy ? ` — ${p.captionWhy}` : ""}` : "") +
    line("emphasis_words", p.emphasis) +
    line("motion_plan", p.motion) +
    line("audio_plan", p.audio) +
    line("experiment", p.hypothesis ? `${p.hypothesis}${p.variable ? ` | variable: ${p.variable}` : ""}${p.metric ? ` | metric: ${p.metric}` : ""}` : "");
  return body ? `<reel_plan>\n${body}</reel_plan>` : "";
}
