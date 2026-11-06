import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { BarChart3, Clapperboard, Plus, Smartphone } from "lucide-react";
import { IgAccountActions } from "@/components/instagram/actions";
import { InstagramDashboard } from "@/components/instagram/dashboard";
import { IgNotice } from "@/components/instagram/notice";
import { SegmentedLinks } from "@/components/motion";
import { buttonClass, Card, Empty, PageHeader, Pill, STATUS_COLORS, statusLabel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { linkFor } from "@/lib/client-links";
import { getDb, schema } from "@/lib/db";
import { instagramConfigured } from "@/lib/instagram/api";
import { accountData, listAccounts } from "@/lib/instagram/data";
import { DEMO_ACCOUNT, demoData } from "@/lib/instagram/demo";
import { dashHref, dashQuery } from "@/lib/instagram/query";
import { buildDashboard } from "@/lib/instagram/stats";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Shared dashboard" };

type SP = Record<string, string | string[] | undefined>;
const TABS = [
  { key: "instagram", label: "Instagram", icon: BarChart3 },
  { key: "content", label: "Content", icon: Clapperboard },
  { key: "app", label: "App updates", icon: Smartphone },
] as const;
const shortDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * "From <agency>": the dashboard a business you work with shares with you. Only what they switched on, read-only;
 * every query goes through linkFor(), which checks the link belongs to you.
 */
export default async function SharedPage({ params, searchParams }: { params: Promise<{ linkId: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const link = await linkFor(user.id, Number((await params).linkId));
  if (!link) notFound();
  const sp = await searchParams;
  const tabs = TABS.filter((t) => link.shared.includes(t.key));
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? tabs[0]?.key;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const db = await getDb();
  const base = `/shared/${link.id}`;

  return (
    <>
      <PageHeader title={link.clientName} subtitle={`From ${link.agencyName}`} />
      {!tabs.length ? (
        <Empty title="Nothing shared yet">{link.agencyName} hasn&apos;t switched anything on for you yet.</Empty>
      ) : (
        <>
          {tabs.length > 1 && (
            <SegmentedLinks label="Sections" className="mb-6" active={tab!} items={tabs.map(({ key, label, icon: Icon }) => ({ key, label, href: `${base}?tab=${key}`, icon: <Icon size={15} /> }))} />
          )}
          {tab === "instagram" && (await (async () => {
            // The account the agency connected for this client, or the one you connected yourself.
            const [agencyAccounts, mine] = await Promise.all([listAccounts(link.agencyId, link.clientId), listAccounts(user.id, link.clientId)]);
            const picked = agencyAccounts[0] ?? mine[0];
            const ownerId = agencyAccounts[0] ? link.agencyId : user.id;
            const q = dashQuery(sp, today);
            const source = picked ? await accountData(ownerId, picked.id) : demoData(today);
            const data = buildDashboard({ ...source, from: q.from, to: q.to, kind: q.kind, tz: settings.timezone });
            return (
              <>
                <IgNotice flag={typeof sp.ig === "string" ? sp.ig : undefined} />
                {!picked && (
                  <Card className="mb-4 flex flex-col gap-2 p-4 text-[14px] text-label-2">
                    <p className="text-[15px] font-semibold text-label">Connect your Instagram</p>
                    <p>
                      Your account must be a <strong>professional</strong> account (Business or Creator). Once connected, you and {link.agencyName} both see these numbers (only this account, only here); you can disconnect any time.
                    </p>
                  </Card>
                )}
                <InstagramDashboard
                  data={data}
                  account={picked ? { ...picked } : DEMO_ACCOUNT}
                  query={q}
                  href={dashHref(base, { tab: "instagram" }, q)}
                  actions={
                    <>
                      {picked && ownerId === user.id && <IgAccountActions accountId={picked.id} username={picked.username} />}
                      {!picked && instagramConfigured() && (
                        <a href={`/api/instagram/connect?for=link:${link.id}&back=${encodeURIComponent(`${base}?tab=instagram`)}`} className={buttonClass("filled", "sm")}>
                          <Plus size={14} /> Connect Instagram
                        </a>
                      )}
                    </>
                  }
                />
              </>
            );
          })())}
          {tab === "content" && (await (async () => {
            const [reels, carousels] = await Promise.all([
              db
                .select({ id: schema.reels.id, title: schema.reels.title, status: schema.reels.status, date: schema.reels.postDate, updatedAt: schema.reels.updatedAt })
                .from(schema.reels)
                .where(and(eq(schema.reels.userId, link.agencyId), eq(schema.reels.clientId, link.clientId), inArray(schema.reels.status, ["review", "posted"])))
                .orderBy(desc(schema.reels.updatedAt)),
              db
                .select({ id: schema.carousels.id, title: schema.carousels.title, status: schema.carousels.status, updatedAt: schema.carousels.updatedAt })
                .from(schema.carousels)
                .where(and(eq(schema.carousels.userId, link.agencyId), eq(schema.carousels.clientId, link.clientId), inArray(schema.carousels.status, ["review", "approved", "posted"])))
                .orderBy(desc(schema.carousels.updatedAt)),
            ]);
            const items = [...reels.map((r) => ({ ...r, kind: "Reel" })), ...carousels.map((c) => ({ ...c, date: null as string | null, kind: "Carousel" }))].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
            return items.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((i) => (
                  <Card key={`${i.kind}-${i.id}`} className="flex flex-col gap-1.5 p-4">
                    <p className="text-[12px] font-semibold text-label-2 uppercase">{i.kind}</p>
                    <p className="text-[16px] font-semibold">{i.title}</p>
                    <div className="flex items-center gap-2">
                      <Pill color={STATUS_COLORS[i.status]}>{i.status === "review" ? "Ready for your review" : statusLabel(i.status)}</Pill>
                      <span className="text-[12px] text-label-3">{i.date ? shortDate(i.date) : shortDate(i.updatedAt)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty icon={<Clapperboard size={34} />} title="No content to show yet">Reels and carousels appear here when they&apos;re ready for review or posted.</Empty>
            );
          })())}
          {tab === "app" && (await (async () => {
            const updates = await db
              .select()
              .from(schema.appUpdates)
              .where(and(eq(schema.appUpdates.userId, link.agencyId), eq(schema.appUpdates.clientId, link.clientId)))
              .orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id));
            return updates.length ? (
              <div className="flex flex-col gap-3">
                {updates.map((u) => (
                  <Card key={u.id} className="flex flex-col gap-1.5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[16px] font-semibold">
                        {u.version && `${u.version} · `}
                        {u.title}
                      </p>
                      <Pill color={STATUS_COLORS[u.status]}>{statusLabel(u.status)}</Pill>
                      {u.date && <span className="text-[12px] text-label-3">{shortDate(u.date)}</span>}
                    </div>
                    {u.notes && <p className="text-[14px] whitespace-pre-wrap text-label-2">{u.notes}</p>}
                  </Card>
                ))}
              </div>
            ) : (
              <Empty icon={<Smartphone size={34} />} title="No updates yet" />
            );
          })())}
        </>
      )}
    </>
  );
}
