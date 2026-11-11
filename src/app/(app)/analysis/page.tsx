import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowUpRight, Briefcase, ChartNoAxesCombined, Mail, MapPin, Phone, Target } from "lucide-react";
import { ImportLeads, LeadStatusSelect } from "@/components/leads";
import { GlassCard } from "@/components/glass";
import { Empty, PageHeader, Pill } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL } from "@/lib/leads";

export const metadata = { title: "Analysis" };

const OPEN = new Set(["new", "drafted", "sent", "replied", "meeting"]);
/** How close a lead is to becoming a client; the next clients are the ones furthest along, then the best fit. */
const STAGE = { meeting: 5, replied: 4, sent: 3, drafted: 2, new: 1, won: 0, lost: 0 } as const;

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <GlassCard as="div" className="p-4">
      <p className="text-[13px] text-label-2">{label}</p>
      <p className="mt-1 text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-label-3">{hint}</p>}
    </GlassCard>
  );
}

export default async function AnalysisPage() {
  const user = await requireUser();
  const db = await getDb();
  const [leads, clients] = await Promise.all([
    db.select().from(schema.leads).where(eq(schema.leads.userId, user.id)).orderBy(desc(schema.leads.score), asc(schema.leads.business)),
    db
      .select()
      .from(schema.clients)
      .where(and(eq(schema.clients.userId, user.id), eq(schema.clients.archived, false)))
      .orderBy(asc(schema.clients.name)),
  ]);
  const open = leads.filter((l) => OPEN.has(l.status));
  const next = [...open].sort((a, b) => STAGE[b.status] - STAGE[a.status] || b.score - a.score).slice(0, 6);
  const contacted = leads.filter((l) => ["sent", "replied", "meeting", "won", "lost"].includes(l.status)).length;
  const replied = leads.filter((l) => ["replied", "meeting", "won"].includes(l.status)).length;
  const strong = open.filter((l) => l.score >= 4).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analysis" subtitle="Who you work with next, and everyone you work with now" actions={<ImportLeads />} />

      <section aria-label="Pipeline" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open leads" value={open.length} hint={`${strong} strong fit (4–5)`} />
        <Stat label="Contacted" value={contacted} hint="Messages you have sent" />
        <Stat label="Reply rate" value={contacted ? `${Math.round((replied / contacted) * 100)}%` : "–"} hint={`${replied} replied`} />
        <Stat label="Active clients" value={clients.length} />
      </section>

      <section aria-labelledby="next-h" className="flex flex-col gap-3">
        <h2 id="next-h" className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.01em]">
          <Target size={18} aria-hidden className="text-accent" /> Next clients
        </h2>
        {next.length === 0 ? (
          <GlassCard as="div" className="p-2">
            <Empty icon={<ChartNoAxesCombined size={22} />} title="No leads yet">
              Import leads.csv from your Business Brain folder (Documents › Business Brain) with the button above.
            </Empty>
          </GlassCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {next.map((l) => (
              <GlassCard as="article" key={l.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[16px] font-semibold">{l.business}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-label-2">
                      <MapPin size={13} aria-hidden /> {[l.niche, l.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums" aria-label={`Fit ${l.score} of 5`}>
                    {"●".repeat(l.score)}
                    <span className="text-label-3">{"●".repeat(5 - l.score)}</span>
                  </span>
                </div>
                {l.why && <p className="line-clamp-3 text-[14px] text-label-2">{l.why}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <LeadStatusSelect id={l.id} status={l.status} business={l.business} />
                  {l.contact && (
                    <span className="flex min-w-0 items-center gap-1 text-[13px] text-label-2">
                      {l.channel === "email" ? <Mail size={13} aria-hidden /> : <Phone size={13} aria-hidden />}
                      <span className="truncate">{l.contact}</span>
                    </span>
                  )}
                  {l.demoUrl && (
                    <a href={l.demoUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-0.5 text-[13px] font-medium text-accent">
                      Demo <ArrowUpRight size={14} aria-hidden />
                    </a>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {leads.length > 0 && (
        <section aria-labelledby="all-leads-h" className="flex flex-col gap-3">
          <h2 id="all-leads-h" className="text-[19px] font-semibold tracking-[-0.01em]">
            All leads <span className="text-label-3">{leads.length}</span>
          </h2>
          <GlassCard as="div" contrast="high" className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="text-[12px] text-label-2">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Business</th>
                  <th scope="col" className="px-4 py-3 font-medium">Niche</th>
                  <th scope="col" className="px-4 py-3 font-medium">Fit</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-separator">
                    <td className="px-4 py-2.5 font-medium">{l.business}</td>
                    <td className="px-4 py-2.5 text-label-2">{l.niche}</td>
                    <td className="px-4 py-2.5 tabular-nums">{l.score}/5</td>
                    <td className="px-4 py-2.5">
                      <Pill color={LEAD_STATUS_COLOR[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Pill>
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-2.5 text-label-2">{l.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </section>
      )}

      <section aria-labelledby="clients-h" className="flex flex-col gap-3">
        <h2 id="clients-h" className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.01em]">
          <Briefcase size={18} aria-hidden className="text-accent" /> All clients
        </h2>
        {clients.length === 0 ? (
          <GlassCard as="div" className="p-2">
            <Empty icon={<Briefcase size={22} />} title="No clients yet">
              Add one from Clients.
            </Empty>
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} className="rounded-[24px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <GlassCard as="div" interactive className="flex h-full items-start gap-3 p-4">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold">{c.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-label-2">{c.description || c.businessType || "Client"}</p>
                    {c.features.length > 0 && <p className="mt-2 text-[12px] text-label-3">{c.features.join(" · ")}</p>}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
