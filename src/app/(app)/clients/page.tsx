import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { BarChart3, Brain, Briefcase, Plus, Wallet } from "lucide-react";
import { BrainView } from "@/components/brain-view";
import { Sparkline } from "@/components/charts";
import { ClientForm } from "@/components/client-form";
import { ContextMenu } from "@/components/context-menu";
import { FinanceView } from "@/components/finance-view";
import { MarketingView } from "@/components/marketing-view";
import { SegmentedLinks, Slide } from "@/components/motion";
import { PromptsPanel } from "@/components/prompts-panel";
import { Sheet } from "@/components/sheet";
import { buttonClass, Card, Empty, List, PageHeader, Row, Section } from "@/components/ui";
import { createClient, setClientArchived } from "@/app/actions/clients";
import { claudeAvailable } from "@/lib/ai/claude";
import { businessLabel, CLIENT_TOOLS } from "@/lib/client-tools";
import { getDb, schema } from "@/lib/db";
import { loadFinance } from "@/lib/finance";
import { clientSnapshots } from "@/lib/instagram/data";
import { fmt } from "@/lib/instagram/stats";
import { requireModule } from "@/lib/sections";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Clients" };

type View = "clients" | "analytics" | "finance" | "brain" | "marketing";

/** Clients: one card per business you work for; each opens a page with only the tools that business needs. */
export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ new?: string; view?: string }> }) {
  const user = await requireModule("clients");
  const db = await getDb();
  const { new: openNew, view: viewParam } = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const [clients, snaps, aiOn] = await Promise.all([
    db.select().from(schema.clients).where(eq(schema.clients.userId, user.id)).orderBy(asc(schema.clients.name)),
    clientSnapshots(user.id),
    claudeAvailable(user.id),
  ]);
  const active = clients.filter((c) => !c.archived);
  const archived = clients.filter((c) => c.archived);
  const any = (tool: string) => active.some((c) => c.features.includes(tool));

  // Only the views someone's clients actually use.
  const views = [
    { key: "clients" as const, label: "Clients", icon: Briefcase },
    ...(any("instagram") ? [{ key: "analytics" as const, label: "Analytics", icon: BarChart3 }] : []),
    ...(any("finance") ? [{ key: "finance" as const, label: "Finance", icon: Wallet }] : []),
    ...(any("content") ? [{ key: "brain" as const, label: "Brain", icon: Brain }] : []),
  ];
  const view: View = viewParam === "marketing" ? "marketing" : (views.find((v) => v.key === viewParam)?.key ?? "clients");
  const toolLabel = (k: string) => CLIENT_TOOLS.find((t) => t.key === k)?.label ?? k;

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Sheet title="New client" defaultOpen={openNew === "1"} trigger={<><Plus size={16} /> New client</>} triggerClassName={buttonClass("filled")}>
            <ClientForm action={createClient} aiOn={aiOn} />
          </Sheet>
        }
      />
      {views.length > 1 && (
        <SegmentedLinks
          label="Clients sections"
          className="mb-6"
          active={view === "marketing" ? "analytics" : view}
          items={views.map(({ key, label, icon: Icon }) => ({ key, label, href: key === "clients" ? "/clients" : `/clients?view=${key}`, icon: <Icon size={15} /> }))}
        />
      )}
      <Slide group="clients-view" index={Math.max(0, views.findIndex((v) => v.key === view))}>
        {view === "analytics" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active
                .filter((c) => c.features.includes("instagram"))
                .map((c) => {
                  const s = snaps.get(c.id);
                  return (
                    <Link key={c.id} href={`/clients/${c.id}?tab=instagram`} className="glass flex flex-col gap-2 rounded-[24px] p-4 transition hover:-translate-y-0.5">
                      <p className="flex items-center gap-2 text-[16px] font-semibold">
                        <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </p>
                      {s ? (
                        <>
                          <p className="text-[13px] text-label-2">
                            @{s.username} · {s.followers === null ? "–" : fmt(s.followers)} followers · {s.reach30 === null ? "–" : fmt(s.reach30)} reach in 30 days
                          </p>
                          {s.spark.length > 1 && <Sparkline values={s.spark} className="text-accent" />}
                        </>
                      ) : (
                        <p className="text-[13px] text-label-3">Instagram not connected yet</p>
                      )}
                    </Link>
                  );
                })}
            </div>
            <p className="text-[13px] text-label-2">
              Posts on other platforms are logged by hand:{" "}
              <Link href="/clients?view=marketing" className="font-semibold text-accent">
                Manual post stats
              </Link>
            </p>
          </div>
        )}
        {view === "marketing" && (
          <MarketingView uid={user.id} clients={active} today={today} currency={settings.moneyCurrency} incomeThisMonth={(await loadFinance(user.id, today, settings.moneyCurrency)).incomeThisMonth} />
        )}
        {view === "finance" && <FinanceView uid={user.id} clients={active} today={today} currency={settings.moneyCurrency} />}
        {view === "brain" && (
          <>
            <PromptsPanel uid={user.id} clients={active} />
            <h2 className="mb-3 text-[22px] font-bold">Researched rules</h2>
            <BrainView />
          </>
        )}
        {view === "clients" && (
          <>
            {active.length === 0 ? (
              <Empty icon={<Briefcase size={36} />} title="No clients yet">
                Add a business you work for. Pick its type and the tools it needs; its page shows only those.
              </Empty>
            ) : (
              <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((c) => {
                  const s = c.features.includes("instagram") ? snaps.get(c.id) : undefined;
                  return (
                    <ContextMenu key={c.id} items={[{ label: "Archive client", destructive: true, confirm: `Archive ${c.name}? You can restore it below, under Archived.`, action: setClientArchived.bind(null, c.id, true) }]}>
                      <Link href={`/clients/${c.id}`} className="group block h-full">
                        <Card className="flex h-full flex-col gap-3 p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                          <div className="flex items-center gap-3">
                            <div className="grid size-11 shrink-0 place-items-center rounded-xl text-[19px] font-bold text-white" style={{ background: c.color }}>
                              {c.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[18px] font-semibold">{c.name}</p>
                              <p className="truncate text-[13px] text-label-2">{businessLabel(c.businessType) || "Business"}</p>
                            </div>
                          </div>
                          {c.description && <p className="line-clamp-2 text-[14px] text-label-2">{c.description}</p>}
                          {s && (
                            <div className="rounded-[16px] bg-well px-3 py-2">
                              <p className="text-[12px] text-label-2">
                                @{s.username} · <strong className="text-label">{s.followers === null ? "–" : fmt(s.followers)}</strong> followers
                              </p>
                              {s.spark.length > 1 && <Sparkline values={s.spark} className="text-accent" />}
                            </div>
                          )}
                          <div className="mt-auto flex flex-wrap gap-1.5">
                            {c.features.length ? (
                              c.features.map((f) => (
                                <span key={f} className="chip !h-6 !text-[12px]">
                                  {toolLabel(f)}
                                </span>
                              ))
                            ) : (
                              <span className="text-[12px] text-label-3">No tools yet</span>
                            )}
                          </div>
                        </Card>
                      </Link>
                    </ContextMenu>
                  );
                })}
              </div>
            )}
            {archived.length > 0 && (
              <Section title="Archived">
                <List>
                  {archived.map((c) => (
                    <Row key={c.id}>
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      <Link href={`/clients/${c.id}`} className="flex-1">
                        {c.name}
                      </Link>
                      <form action={setClientArchived.bind(null, c.id, false)}>
                        <button className={buttonClass("plain", "sm")}>Restore</button>
                      </form>
                    </Row>
                  ))}
                </List>
              </Section>
            )}
          </>
        )}
      </Slide>
    </>
  );
}
