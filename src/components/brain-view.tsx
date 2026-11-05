import { ExternalLink } from "lucide-react";
import { CAPTION_STYLE_GUIDE, HOOK_FORMULAS, NICHE_MATRIX, NICHES, REVIEW, RULES, SOURCES } from "@/lib/reels-brain/content";
import { Card, Pill, Section } from "./ui";

const CONF: Record<string, string> = { High: "var(--green)", Medium: "var(--orange)", Low: "var(--label-2)" };

/** Clients → Reels Brain: the researched rules, review checklist, hooks, caption styles, niche defaults and sources. */
export function BrainView() {
  return (
    <div>
      <Card className="mb-8 p-4 text-[14px] leading-relaxed text-label-2">
        Researched craft rules for short-form video (Nov 2026). Each rule shows its evidence (S standard/law · P platform · R research · H professional heuristic · X hypothesis · O own
        test) and a confidence. Opus uses these on every reel; the brief, your saved prompts and the client profile override them. Platform facts change: re-check them every few months.
      </Card>

      {RULES.map((g) => (
        <Section key={g.id} title={g.title}>
          <div className="grid gap-3 md:grid-cols-2">
            {g.rules.map((r) => (
              <Card key={r.title} className="p-4">
                <div className="mb-1 flex items-start gap-2">
                  <p className="flex-1 text-[15px] font-semibold">{r.title}</p>
                  <Pill color={CONF[r.confidence]}>{r.confidence}</Pill>
                </div>
                <p className="text-[14px] leading-relaxed">{r.body}</p>
                <p className="mt-2 text-[12px] text-label-2">{r.evidence}</p>
              </Card>
            ))}
          </div>
        </Section>
      ))}

      <Section title="Caption style by video">
        <Card className="divide-y divide-[var(--separator)]">
          {CAPTION_STYLE_GUIDE.map((c) => (
            <div key={c.style} className="grid gap-1 p-4 text-[14px] md:grid-cols-[200px_1fr_1fr]">
              <p className="font-semibold">{c.style}</p>
              <p>{c.when}</p>
              <p className="text-label-2">{c.why}</p>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Hook formulas (always true, always paid off)">
        <div className="grid gap-3 md:grid-cols-2">
          {HOOK_FORMULAS.map((h) => (
            <Card key={h.name} className="p-4 text-[14px]">
              <p className="font-semibold">{h.name}</p>
              <p className="text-label-2">{h.template}</p>
              <p className="mt-1">{h.example}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Review checklist (on the actual render)">
        <div className="grid gap-3 md:grid-cols-2">
          {REVIEW.map((g) => (
            <Card key={g.title} className="p-4">
              <p className="mb-2 text-[15px] font-semibold">{g.title}</p>
              <ul className="list-disc space-y-1 pl-5 text-[14px]">
                {g.items.map((i) => (
                  <li key={i.id}>{i.label}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Defaults by niche (starting points, not data)">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--separator)]">
                <th className="p-3 font-semibold text-label-2">Decision</th>
                {NICHES.map((n) => (
                  <th key={n} className="p-3 font-semibold">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NICHE_MATRIX.map((row) => (
                <tr key={row.decision} className="border-b border-[var(--separator)] align-top last:border-0">
                  <td className="p-3 font-semibold text-label-2">{row.decision}</td>
                  {NICHES.map((n) => (
                    <td key={n} className="p-3">
                      {row.cells[n]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Key sources">
        <Card className="divide-y divide-[var(--separator)]">
          {SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 text-[14px] hover:bg-fill">
              <span className="flex-1">{s.label}</span>
              <span className="text-[12px] text-label-2">{s.type}</span>
              <ExternalLink size={13} className="text-label-3" />
            </a>
          ))}
        </Card>
      </Section>
    </div>
  );
}
