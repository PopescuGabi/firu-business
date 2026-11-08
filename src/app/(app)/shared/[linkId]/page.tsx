import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Board } from "@/components/board/board";
import { CLIENT_DEFAULT, clientCatalogue, clientWidgets, isInstagramWidget } from "@/components/client-board";
import { IgAccountActions } from "@/components/instagram/actions";
import { IG_FOOTNOTE, InstagramToolbar } from "@/components/instagram/dashboard";
import { IgNotice } from "@/components/instagram/notice";
import { buttonClass, Card, Empty } from "@/components/ui";
import { resetSharedBoard, saveSharedBoard } from "@/app/actions/board";
import { requireUser } from "@/lib/auth";
import { boardIds, normalizeLayout, sharedBoardKey } from "@/lib/board";
import { linkFor } from "@/lib/client-links";
import { getDb, schema } from "@/lib/db";
import { instagramConfigured } from "@/lib/instagram/api";
import { accountData, listAccounts } from "@/lib/instagram/data";
import { DEMO_ACCOUNT, demoData } from "@/lib/instagram/demo";
import { dashHref, dashQuery } from "@/lib/instagram/query";
import { buildDashboard } from "@/lib/instagram/stats";
import { getSetting, getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Shared dashboard" };

type SP = Record<string, string | string[] | undefined>;

/**
 * "From <agency>": the dashboard a business you work with shares with you, as a board. It starts as the business
 * arranged it; you can rearrange your own view (kept in your settings) and go back to theirs. Only what they share;
 * every query goes through linkFor(), which checks the link belongs to you.
 */
export default async function SharedPage({ params, searchParams }: { params: Promise<{ linkId: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const link = await linkFor(user.id, Number((await params).linkId));
  if (!link) notFound();
  const sp = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const db = await getDb();
  const base = `/shared/${link.id}`;
  const header = (
    <div className="pt-2">
      <p className="text-[13px] text-label-2">From {link.agencyName}</p>
      <h1 className="truncate text-[34px] leading-tight font-bold tracking-tight">{link.clientName}</h1>
    </div>
  );

  const catalogue = clientCatalogue(link.shared);
  if (!catalogue.length)
    return (
      <>
        {header}
        <Empty title="Nothing shared yet">{link.agencyName} hasn&apos;t switched anything on for you yet.</Empty>
      </>
    );

  // Your own arrangement, else the one the business made for you, else the default.
  const [mine, [agency]] = await Promise.all([
    getSetting<unknown>(user.id, sharedBoardKey(link.id)),
    db.select({ layout: schema.clients.dashboardLayout }).from(schema.clients).where(and(eq(schema.clients.id, link.clientId), eq(schema.clients.userId, link.agencyId))),
  ]);
  const layout = normalizeLayout(mine ?? agency?.layout ?? null, catalogue.map((w) => w.def), CLIENT_DEFAULT);
  const ids = new Set(boardIds(layout));
  const anyIg = link.shared.includes("instagram") && catalogue.some((w) => isInstagramWidget(w.def.id));

  // Instagram: the account the business connected for you, or the one you connected yourself.
  let toolbar: React.ReactNode = null;
  let instagram = null;
  if (anyIg) {
    const [agencyAccounts, own] = await Promise.all([listAccounts(link.agencyId, link.clientId), listAccounts(user.id, link.clientId)]);
    const picked = agencyAccounts[0] ?? own[0];
    const ownerId = agencyAccounts[0] ? link.agencyId : user.id;
    const query = dashQuery(sp, today);
    const source = picked ? await accountData(ownerId, picked.id) : demoData(today);
    const data = buildDashboard({ ...source, from: query.from, to: query.to, kind: query.kind, tz: settings.timezone });
    const href = dashHref(base, {}, query);
    instagram = { data, query, href };
    toolbar = (
      <>
        <IgNotice flag={typeof sp.ig === "string" ? sp.ig : undefined} />
        {!picked && (
          <Card className="mb-4 flex flex-col gap-2 p-4 text-[14px] text-label-2">
            <p className="text-[15px] font-semibold text-label">Connect your Instagram</p>
            <p>
              Your account must be a <strong>professional</strong> account (Business or Creator). Once connected, you and {link.agencyName} both see these numbers (only this account,
              only here); you can disconnect any time.
            </p>
          </Card>
        )}
        <InstagramToolbar
          data={data}
          account={picked ? { ...picked } : DEMO_ACCOUNT}
          query={query}
          href={href}
          actions={
            <>
              {picked && ownerId === user.id && <IgAccountActions accountId={picked.id} username={picked.username} />}
              {!picked && instagramConfigured() && (
                <a href={`/api/instagram/connect?for=link:${link.id}&back=${encodeURIComponent(base)}`} className={buttonClass("filled", "sm")}>
                  <Plus size={14} /> Connect Instagram
                </a>
              )}
            </>
          }
        />
      </>
    );
  }
  const widgets = await clientWidgets({ ids, agencyId: link.agencyId, clientId: link.clientId, instagram });

  return (
    <>
      <Board
        widgets={widgets}
        catalogue={catalogue}
        layout={layout}
        save={saveSharedBoard.bind(null, link.id)}
        reset={resetSharedBoard.bind(null, link.id)}
        resetLabel={`Reset to ${link.agencyName}'s layout`}
        header={header}
        notice={toolbar}
      />
      {anyIg && <p className="mt-4 px-1 text-[12px] text-label-3">{IG_FOOTNOTE}</p>}
    </>
  );
}
