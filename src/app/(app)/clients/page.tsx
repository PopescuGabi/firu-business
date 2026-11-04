import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { BarChart3, Briefcase, Plus, Wallet } from "lucide-react";
import { SegmentedLinks, Slide } from "@/components/motion";
import { MarketingView } from "@/components/marketing-view";
import { FinanceView } from "@/components/finance-view";
import { loadFinance } from "@/lib/finance";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";
import { ClientForm } from "@/components/client-form";
import { Sheet } from "@/components/sheet";
import { buttonClass, Card, Empty, List, PageHeader, Row, Section } from "@/components/ui";
import { createClient, setClientArchived } from "@/app/actions/clients";
import { requireModule } from "@/lib/sections";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Clients" };

const VIEWS = [
  { key: "clients", label: "Clients", icon: Briefcase },
  { key: "marketing", label: "Marketing", icon: BarChart3 },
  { key: "finance", label: "Finance", icon: Wallet },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ new?: string; view?: string }> }) {
  const user = await requireModule("clients");
  const db = await getDb();
  const { new: openNew, view: viewParam } = await searchParams;
  const view: View = VIEWS.some((v) => v.key === viewParam) ? (viewParam as View) : "clients";
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const [clients, reels, carousels, updates] = await Promise.all([
    db.select().from(schema.clients).where(eq(schema.clients.userId, user.id)).orderBy(asc(schema.clients.name)),
    db.select({ clientId: schema.reels.clientId, n: count() }).from(schema.reels).where(eq(schema.reels.userId, user.id)).groupBy(schema.reels.clientId),
    db.select({ clientId: schema.carousels.clientId, n: count() }).from(schema.carousels).where(eq(schema.carousels.userId, user.id)).groupBy(schema.carousels.clientId),
    db.select({ clientId: schema.appUpdates.clientId, n: count() }).from(schema.appUpdates).where(eq(schema.appUpdates.userId, user.id)).groupBy(schema.appUpdates.clientId),
  ]);
  const n = (list: { clientId: number; n: number }[], id: number) => list.find((x) => x.clientId === id)?.n ?? 0;
  const active = clients.filter((c) => !c.archived);
  const archived = clients.filter((c) => c.archived);

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Sheet title="New client" defaultOpen={openNew === "1"} trigger={<><Plus size={16} /> New client</>} triggerClassName={buttonClass("filled")}>
            <ClientForm action={createClient} />
          </Sheet>
        }
      />
      <SegmentedLinks
        label="Clients sections"
        className="mb-6"
        active={view}
        items={VIEWS.map(({ key, label, icon: Icon }) => ({ key, label, href: key === "clients" ? "/clients" : `/clients?view=${key}`, icon: <Icon size={15} /> }))}
      />
      <Slide group="clients-view" index={VIEWS.findIndex((v) => v.key === view)}>
      {view === "marketing" && (
        <MarketingView uid={user.id} clients={active} today={today} currency={settings.moneyCurrency} incomeThisMonth={(await loadFinance(user.id, today, settings.moneyCurrency)).incomeThisMonth} />
      )}
      {view === "finance" && <FinanceView uid={user.id} clients={active} today={today} currency={settings.moneyCurrency} />}
      {view === "clients" && (<>
      {active.length === 0 ? (
        <Empty icon={<Briefcase size={36} />} title="No clients yet">Add a client to track their app, reels and carousels.</Empty>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="group">
              <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <div className="mb-3 grid size-11 place-items-center rounded-xl text-[19px] font-bold text-white" style={{ background: c.color }}>
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <p className="text-[19px] font-semibold">{c.name}</p>
                {c.description && <p className="mt-0.5 line-clamp-2 text-[14px] text-label-2">{c.description}</p>}
                <div className="mt-4 flex gap-4 text-[13px] text-label-2">
                  {c.appName && <span><strong className="text-label">{n(updates, c.id)}</strong> app updates</span>}
                  <span><strong className="text-label">{n(reels, c.id)}</strong> reels</span>
                  <span><strong className="text-label">{n(carousels, c.id)}</strong> carousels</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <Section title="Archived">
          <List>
            {archived.map((c) => (
              <Row key={c.id}>
                <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                <Link href={`/clients/${c.id}`} className="flex-1">{c.name}</Link>
                <form action={setClientArchived.bind(null, c.id, false)}>
                  <button className={buttonClass("plain", "sm")}>Restore</button>
                </form>
              </Row>
            ))}
          </List>
        </Section>
      )}
      </>)}
      </Slide>
    </>
  );
}
