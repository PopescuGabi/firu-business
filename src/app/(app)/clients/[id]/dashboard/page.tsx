import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { Board } from "@/components/board/board";
import { CLIENT_DEFAULT, clientCatalogue, clientWidgets, isInstagramWidget } from "@/components/client-board";
import { InstagramToolbar } from "@/components/instagram/dashboard";
import { Empty } from "@/components/ui";
import { resetClientBoard, saveClientBoard } from "@/app/actions/board";
import { boardIds, normalizeLayout } from "@/lib/board";
import { clientAccess, shareableFor } from "@/lib/client-links";
import { getDb, schema } from "@/lib/db";
import { accountData, listAccounts } from "@/lib/instagram/data";
import { DEMO_ACCOUNT, demoData } from "@/lib/instagram/demo";
import { dashHref, dashQuery } from "@/lib/instagram/query";
import { buildDashboard } from "@/lib/instagram/stats";
import { requireModule } from "@/lib/sections";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Their dashboard" };

type SP = Record<string, string | string[] | undefined>;

/**
 * The client's dashboard as they'll see it, with their real numbers: arrange it here and that's where they start.
 * They can rearrange their own view afterwards; yours stays as you left it.
 */
export default async function ClientDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requireModule("clients");
  const id = Number((await params).id);
  const sp = await searchParams;
  const db = await getDb();
  const [client] = Number.isInteger(id)
    ? await db.select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)))
    : [];
  if (!client) notFound();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const access = await clientAccess(user.id, client.id);
  // What they see: what you share with them, or (before they accept) everything you could share.
  const shared = access.link ? access.link.shared : shareableFor(client.features);
  const base = `/clients/${client.id}/dashboard`;
  const header = (
    <div className="pt-2">
      <Link href={`/clients/${client.id}`} className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
        <ChevronLeft size={15} /> {client.name}
      </Link>
      <h1 className="text-[30px] leading-tight font-bold tracking-tight">Their dashboard</h1>
      <p className="text-[13px] text-label-2">
        What {access.link?.name || client.name} sees, with their real numbers. Arrange it and they start from this; they can rearrange their own view.
      </p>
    </div>
  );

  const catalogue = clientCatalogue(shared);
  if (!catalogue.length)
    return (
      <>
        {header}
        <Empty title="Nothing to share yet">Turn on Instagram, content or app updates for {client.name} first.</Empty>
      </>
    );

  const layout = normalizeLayout(client.dashboardLayout, catalogue.map((w) => w.def), CLIENT_DEFAULT);
  const ids = new Set(boardIds(layout));

  let toolbar: React.ReactNode = null;
  let instagram = null;
  if (shared.includes("instagram") && [...ids].some(isInstagramWidget)) {
    // The account you connected for them, else the one they connected themselves (when they share it).
    const own = await listAccounts(user.id, client.id);
    const theirs = !own.length && access.link?.shared.includes("instagram") ? await listAccounts(access.link.clientUserId, client.id) : [];
    const picked = own[0] ?? theirs[0];
    const query = dashQuery(sp, today);
    const source = picked ? await accountData(own[0] ? user.id : access.link!.clientUserId, picked.id) : demoData(today);
    const data = buildDashboard({ ...source, from: query.from, to: query.to, kind: query.kind, tz: settings.timezone });
    const href = dashHref(base, {}, query);
    instagram = { data, query, href };
    toolbar = <InstagramToolbar data={data} account={picked ? { ...picked } : DEMO_ACCOUNT} query={query} href={href} />;
  }
  const widgets = await clientWidgets({ ids, agencyId: user.id, clientId: client.id, instagram });

  return (
    <Board
      widgets={widgets}
      catalogue={catalogue}
      layout={layout}
      save={saveClientBoard.bind(null, client.id)}
      reset={resetClientBoard.bind(null, client.id)}
      resetLabel="Reset to default"
      header={header}
      notice={toolbar}
    />
  );
}
