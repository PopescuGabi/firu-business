// Pure: a client's brand profile (who the content is for), and the same as text for Claude.
// Safe to import on client and server.
import { z } from "zod";

const t = (max: number) => z.string().max(max).default("");

export const AWARENESS = ["", "unaware", "problem", "solution", "product", "most"] as const;
export const OBJECTIVES = ["", "reach", "community", "authority", "leads", "sales"] as const;

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

const line = (label: string, v: string | undefined) => (v && v.trim() ? `<${label}>${v.trim()}</${label}>\n` : "");

/** The profile as text for Claude; an empty one says so, so Claude asks or marks its assumptions. */
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
