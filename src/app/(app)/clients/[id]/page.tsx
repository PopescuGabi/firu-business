import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { Archive, BarChart3, Clapperboard, ExternalLink, FolderOpen, GalleryHorizontalEnd, LayoutDashboard, ListTodo, Pencil, Plus, Share2, Smartphone, Trash2, UserRound, Wallet } from "lucide-react";
import { TaskCheck } from "@/components/check";
import { ClientTabsEditor } from "@/components/client-tabs-editor";
import { PageBlocks } from "@/components/custom/blocks";
import { iconFor } from "@/components/custom/icons";
import { PageCoach } from "@/components/custom/page-coach";
import { PageSettings } from "@/components/custom/page-settings";
import { TaskForm } from "@/components/task-form";
import type { ChatMessage } from "@/components/claude-panel";
import { createTask } from "@/app/actions/tasks";
import { BUILTIN_TABS, builtinTab, pageIdOf, tabsFor } from "@/lib/client-tabs";
import { clientPages, pageItems } from "@/lib/custom-pages-db";
import { STARTER_KEYS } from "@/lib/tab-starters";
import { TEMPLATE_GROUPS } from "@/lib/page-templates";
import { ClientAccess } from "@/components/client-access";
import { ClientForm } from "@/components/client-form";
import { ClientProfileForm } from "@/components/client-profile";
import { ContextMenu } from "@/components/context-menu";
import { DriveFiles } from "@/components/drive-files";
import { DriveFolderButton } from "@/components/drive-folder-button";
import { FinanceView } from "@/components/finance-view";
import { IgAccountActions } from "@/components/instagram/actions";
import { InstagramDashboard } from "@/components/instagram/dashboard";
import { IgNotice } from "@/components/instagram/notice";
import { SegmentedLinks, Slide } from "@/components/motion";
import { Sheet } from "@/components/sheet";
import { SlidePreview } from "@/components/slide-preview";
import { DeleteFooter, Submit } from "@/components/submit";
import { buttonClass, Card, Empty, Field, PageHeader, Pill, STATUS_COLORS, statusLabel } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import {
  createAppUpdate,
  createCarousel,
  createReel,
  deleteAppUpdate,
  deleteCarousel,
  deleteReel,
  editAppUpdate,
  setClientArchived,
  updateClient,
} from "@/app/actions/clients";
import { claudeAvailable } from "@/lib/ai/claude";
import { businessLabel } from "@/lib/client-tools";
import { clientAccess, SHAREABLE } from "@/lib/client-links";
import { env } from "@/lib/env";
import { GMAIL_SCOPES, hasScope } from "@/lib/google/oauth";
import { getDb, schema } from "@/lib/db";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/fx-math";
import { folderUrl } from "@/lib/google/drive";
import { getGoogleAccount } from "@/lib/google/oauth";
import { instagramConfigured } from "@/lib/instagram/api";
import { accountData, clientSnapshots, listAccounts } from "@/lib/instagram/data";
import { DEMO_ACCOUNT, demoData } from "@/lib/instagram/demo";
import { dashHref, dashQuery } from "@/lib/instagram/query";
import { buildDashboard, fmt } from "@/lib/instagram/stats";
import { requireModule } from "@/lib/sections";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

// Icons for the built-in tabs (lib/client-tabs.ts lists them; each client chooses its own set and order).
const TAB_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  layout: LayoutDashboard,
  chart: BarChart3,
  clapperboard: Clapperboard,
  phone: Smartphone,
  wallet: Wallet,
  user: UserRound,
  list: ListTodo,
  folder: FolderOpen,
  share: Share2,
};

const REEL_STATUSES = ["idea", "scripting", "filming", "editing", "review", "posted"];
type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("clients");
  const db = await getDb();
  const [c] = await db
    .select({ name: schema.clients.name })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, Number((await params).id) || 0), eq(schema.clients.userId, user.id)));
  return { title: c?.name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const user = await requireModule("clients");
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)));
  if (!client) notFound();
  const sp = await searchParams;
  // This client's own tab list (built-in tabs and its own pages), in the order chosen in "Edit tabs".
  const pages = await clientPages(user.id, id);
  const tabKeys = tabsFor(client.tabs, client.features, pages.map((p) => p.id));
  const tabs = tabKeys.map((key) => {
    const page = pages.find((p) => p.id === pageIdOf(key));
    if (page) return { key, label: page.title, icon: iconFor(page.icon) };
    const b = builtinTab(key)!;
    return { key, label: key === "app" && client.appName ? client.appName : b.label, icon: TAB_ICONS[b.icon] ?? LayoutDashboard };
  });
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "overview";
  const openPage = pages.find((p) => p.id === pageIdOf(tab));
  const [googleConnected, settings, aiOn] = await Promise.all([getGoogleAccount(user.id).then((a) => Boolean(a?.accessToken)), getSettings(user.id), claudeAvailable(user.id)]);
  const today = todayIn(settings.timezone);

  return (
    <>
      <PageHeader
        subtitle={client.archived ? "Archived client" : businessLabel(client.businessType) || "Client"}
        title={client.name}
        actions={
          <>
            {googleConnected && <DriveFolderButton clientId={id} url={client.driveFolderId ? folderUrl(client.driveFolderId) : null} />}
            <Sheet title="Edit client" trigger={<Pencil size={16} />} triggerLabel="Edit client" triggerClassName={buttonClass("gray") + " !px-3"}>
              <ClientForm action={updateClient.bind(null, id)} client={client} submitLabel="Save" aiOn={aiOn} />
              {!client.archived && (
                <DeleteFooter action={setClientArchived.bind(null, id, true)} message={`Archive ${client.name}? You can restore it from the Clients page.`}>
                  <Archive size={15} /> Archive client
                </DeleteFooter>
              )}
            </Sheet>
          </>
        }
      />
      {client.description && <p className="-mt-3 mb-5 text-[15px] text-label-2">{client.description}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <SegmentedLinks
          label="Sections"
          active={tab}
          items={tabs.map(({ key, label, icon: Icon }) => ({ key, label, href: key === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${key}`, icon: <Icon size={15} /> }))}
        />
        <ClientTabsEditor
          clientId={id}
          tabs={tabKeys}
          builtins={BUILTIN_TABS.map(({ key, label, hint, tool, needs }) => ({ key, label: key === "app" && client.appName ? client.appName : label, hint, tool, needs }))}
          pages={pages.map((p) => ({ id: p.id, title: p.title }))}
          starters={STARTER_KEYS}
          templates={TEMPLATE_GROUPS.flatMap((g) => g.pages.map((pg, i) => ({ key: `${g.key}:${i}`, title: String(pg.title), group: g.label })))}
          today={today}
        />
      </div>

      <Slide group={`client-tab-${id}`} index={tabs.findIndex((t) => t.key === tab)}>
        {tab === "overview" && (
          <div className="flex flex-col gap-6">
            <OverviewTab userId={user.id} client={client} today={today} currency={settings.moneyCurrency} />
          </div>
        )}
        {tab === "dashboard" && (
          <DashboardAccess userId={user.id} client={client} agencyName={settings.displayName || (user.name ?? "").split(" ")[0] || user.email.split("@")[0]} />
        )}
        {tab === "tasks" && <TasksTab userId={user.id} client={client} today={today} />}
        {tab === "files" && <FilesTab userId={user.id} client={client} googleConnected={googleConnected} />}
        {openPage && <OwnTab userId={user.id} page={openPage} today={today} aiOn={aiOn} />}
        {tab === "instagram" && <InstagramTab userId={user.id} clientId={id} sp={sp} today={today} tz={settings.timezone} />}
        {tab === "content" && (
          <div className="flex flex-col gap-8">
            <ReelsTab userId={user.id} clientId={id} />
            <CarouselsTab userId={user.id} clientId={id} />
          </div>
        )}
        {tab === "app" && <AppTab userId={user.id} clientId={id} appName={client.appName} googleConnected={googleConnected} />}
        {tab === "finance" && <FinanceView uid={user.id} clients={[client]} clientId={id} today={today} currency={settings.moneyCurrency} />}
        {tab === "profile" && <ClientProfileForm clientId={id} initial={client.profile} />}
      </Slide>
    </>
  );
}

type ClientRow = typeof schema.clients.$inferSelect;

/** One look at the client: only the tools they have, each with its key numbers and a link. */
async function OverviewTab({ userId, client, today, currency }: { userId: number; client: ClientRow; today: string; currency: "RON" | "EUR" }) {
  const db = await getDb();
  const has = (t: string) => client.features.includes(t);
  const [snap, reelsOpen, reelsPosted, carousels, lastUpdate, money] = await Promise.all([
    has("instagram") ? clientSnapshots(userId).then((m) => m.get(client.id)) : undefined,
    has("content") ? db.select({ n: count() }).from(schema.reels).where(and(eq(schema.reels.userId, userId), eq(schema.reels.clientId, client.id), ne(schema.reels.status, "posted"))).then((r) => r[0].n) : 0,
    has("content") ? db.select({ n: count() }).from(schema.reels).where(and(eq(schema.reels.userId, userId), eq(schema.reels.clientId, client.id), eq(schema.reels.status, "posted"))).then((r) => r[0].n) : 0,
    has("content") ? db.select({ n: count() }).from(schema.carousels).where(and(eq(schema.carousels.userId, userId), eq(schema.carousels.clientId, client.id))).then((r) => r[0].n) : 0,
    has("app")
      ? db.select().from(schema.appUpdates).where(and(eq(schema.appUpdates.userId, userId), eq(schema.appUpdates.clientId, client.id))).orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id)).limit(1).then((r) => r[0])
      : undefined,
    has("finance") ? loadFinance(userId, today, currency, client.id) : undefined,
  ]);
  const tile = "glass flex flex-col gap-2 rounded-[24px] p-4 transition hover:-translate-y-0.5";
  const base = `/clients/${client.id}`;
  if (!client.features.length) {
    return (
      <Empty title="No tools for this client yet">
        Use <strong>Edit tabs</strong> to add what you do for them: Instagram, content, app work, finance, tasks, files, or tabs of your own.
      </Empty>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {has("instagram") && (
        <Link href={`${base}?tab=instagram`} className={tile}>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <BarChart3 size={16} className="text-label-2" /> Instagram
          </p>
          {snap ? (
            <>
              <p className="text-[13px] text-label-2">@{snap.username}</p>
              <p className="text-[28px] leading-none font-bold tracking-tight tabular-nums">{snap.followers === null ? "–" : fmt(snap.followers)}</p>
              <p className="text-[12px] text-label-2">followers · {snap.reach30 === null ? "–" : fmt(snap.reach30)} reach in 30 days</p>
              {snap.spark.length > 1 && <Sparkline values={snap.spark} className="text-accent" />}
            </>
          ) : (
            <p className="text-[14px] text-label-2">Not connected yet. Open to connect their account (or see a demo).</p>
          )}
        </Link>
      )}
      {has("content") && (
        <Link href={`${base}?tab=content`} className={tile}>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Clapperboard size={16} className="text-label-2" /> Content
          </p>
          <p className="text-[28px] leading-none font-bold tabular-nums">{reelsOpen}</p>
          <p className="text-[12px] text-label-2">
            reels in progress · {reelsPosted} posted · {carousels} carousel{carousels === 1 ? "" : "s"}
          </p>
        </Link>
      )}
      {has("app") && (
        <Link href={`${base}?tab=app`} className={tile}>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Smartphone size={16} className="text-label-2" /> {client.appName || "App"}
          </p>
          {lastUpdate ? (
            <>
              <p className="text-[15px] font-medium">
                {lastUpdate.version && `${lastUpdate.version} · `}
                {lastUpdate.title}
              </p>
              <Pill color={STATUS_COLORS[lastUpdate.status]}>{statusLabel(lastUpdate.status)}</Pill>
            </>
          ) : (
            <p className="text-[14px] text-label-2">No updates logged yet.</p>
          )}
        </Link>
      )}
      {has("finance") && money && (
        <Link href={`${base}?tab=finance`} className={tile}>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Wallet size={16} className="text-label-2" /> Finance
          </p>
          <p className="text-[28px] leading-none font-bold tabular-nums">{formatMoney(money.incomeThisMonth, currency, { compact: true })}</p>
          <p className="text-[12px] text-label-2">
            paid this month · {formatMoney(money.waitingTotal, currency, { compact: true })} waiting{money.overdue.length ? ` (${money.overdue.length} overdue)` : ""}
          </p>
        </Link>
      )}
    </div>
  );
}

/** This client's tasks: open ones first by due date, then the done ones. */
async function TasksTab({ userId, client, today }: { userId: number; client: ClientRow; today: string }) {
  const db = await getDb();
  const tasks = await db
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.userId, userId), eq(schema.tasks.clientId, client.id)))
    .orderBy(asc(schema.tasks.done), asc(schema.tasks.due), desc(schema.tasks.id));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Sheet title="New task" trigger={<><Plus size={15} /> New task</>} triggerClassName={buttonClass("filled", "sm")}>
          <TaskForm action={createTask} clients={[{ id: client.id, name: client.name }]} defaultClientId={client.id} />
        </Sheet>
      </div>
      {tasks.length === 0 ? (
        <Empty icon={<ListTodo size={34} />} title="No tasks for this client">Add one here, or pick this client when you add a task anywhere else.</Empty>
      ) : (
        <Card className="divide-y divide-separator">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-4 py-3">
              <TaskCheck id={t.id} done={t.done} label={t.title} />
              <div className="min-w-0 flex-1">
                <p className={t.done ? "text-[15px] text-label-3 line-through" : "text-[15px] font-medium"}>{t.title}</p>
                <p className="text-[12px] text-label-2">
                  {t.due ? (t.due < today && !t.done ? <span className="font-semibold text-red">Overdue ({t.due})</span> : `Due ${t.due === today ? "today" : t.due}`) : "No due date"}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/** Everything saved to Drive for this client (from its reels, carousels and app updates), plus its Drive folder. */
async function FilesTab({ userId, client, googleConnected }: { userId: number; client: ClientRow; googleConnected: boolean }) {
  const db = await getDb();
  const [reels, carousels, updates] = await Promise.all([
    db.select({ title: schema.reels.title, files: schema.reels.files }).from(schema.reels).where(and(eq(schema.reels.userId, userId), eq(schema.reels.clientId, client.id))),
    db.select({ title: schema.carousels.title, files: schema.carousels.files }).from(schema.carousels).where(and(eq(schema.carousels.userId, userId), eq(schema.carousels.clientId, client.id))),
    db.select({ title: schema.appUpdates.title, files: schema.appUpdates.files }).from(schema.appUpdates).where(and(eq(schema.appUpdates.userId, userId), eq(schema.appUpdates.clientId, client.id))),
  ]);
  const files = [
    ...reels.flatMap((r) => r.files.map((f) => ({ ...f, from: `Reel · ${r.title}` }))),
    ...carousels.flatMap((c) => c.files.map((f) => ({ ...f, from: `Carousel · ${c.title}` }))),
    ...updates.flatMap((u) => u.files.map((f) => ({ ...f, from: `Update · ${u.title}` }))),
  ];
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <FolderOpen size={18} className="text-label-2" />
        <p className="min-w-0 flex-1 text-[14px] text-label-2">Files for {client.name} are kept in its own folder in your Google Drive.</p>
        {googleConnected ? (
          <DriveFolderButton clientId={client.id} url={client.driveFolderId ? folderUrl(client.driveFolderId) : null} />
        ) : (
          <Link href="/settings" className={buttonClass("gray", "sm")}>
            Connect Google
          </Link>
        )}
      </Card>
      {files.length === 0 ? (
        <Empty icon={<FolderOpen size={34} />} title="No files yet">Files you upload to this client&apos;s reels, carousels or app updates appear here.</Empty>
      ) : (
        <Card className="divide-y divide-separator">
          {files.map((f) => (
            <a key={f.id} href={f.webViewLink || undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{f.name}</span>
                <span className="block truncate text-[12px] text-label-2">{f.from}</span>
              </span>
              <ExternalLink size={14} className="shrink-0 text-label-3" />
            </a>
          ))}
        </Card>
      )}
    </div>
  );
}

/** One of this client's own tabs: a page made with the page builder, shown like any page, with Claude to change it. */
async function OwnTab({ userId, page, today, aiOn }: { userId: number; page: Awaited<ReturnType<typeof clientPages>>[number]; today: string; aiOn: boolean }) {
  const db = await getDb();
  const [items, chat] = await Promise.all([
    pageItems(userId, page.id),
    db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.userId, userId), eq(schema.aiMessages.targetType, "page"), eq(schema.aiMessages.targetId, page.id)))
      .orderBy(asc(schema.aiMessages.id)),
  ]);
  const messages = chat.map<ChatMessage>((m) => ({ id: m.id, role: m.role as ChatMessage["role"], content: m.content, proposal: m.proposal, applied: m.applied }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PageCoach pageId={page.id} spec={page.spec} messages={messages} claudeConfigured={aiOn} />
        <PageSettings page={page} />
      </div>
      <PageBlocks pageId={page.id} spec={page.spec} items={items} today={today} />
    </div>
  );
}

/** "Their dashboard": invite the client's contact and choose what they see in their own hub. */
async function DashboardAccess({ userId, client, agencyName }: { userId: number; client: ClientRow; agencyName: string }) {
  const [access, account] = await Promise.all([clientAccess(userId, client.id), getGoogleAccount(userId)]);
  const gmailOn = GMAIL_SCOPES.every((s) => hasScope(account, s));
  const shareable = SHAREABLE.filter((s) => client.features.includes(s.key)).map((s) => ({ ...s }));
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-[17px] font-semibold">Their dashboard</h2>
        <p className="text-[13px] text-label-2">
          {access.link
            ? `${client.name} sees this in their own FIRU Business account, under “From ${agencyName}”.`
            : `Invite ${client.name}'s contact: they get their own FIRU Business account, tailored to their business, plus a dashboard from you.`}
        </p>
      </div>
      {shareable.length > 0 && (
        <Link href={`/clients/${client.id}/dashboard`} className={`${buttonClass("gray", "sm")} self-start`}>
          <LayoutDashboard size={14} /> Arrange their dashboard
        </Link>
      )}
      <ClientAccess
        clientId={client.id}
        clientName={client.name}
        access={{
          link: access.link ? { email: access.link.email, name: access.link.name, shared: access.link.shared } : null,
          invite: access.invite ? { email: access.invite.email, sentAt: access.invite.sentAt?.toISOString() ?? null } : null,
        }}
        gmailOn={gmailOn}
        appUrl={env.appUrl()}
        agencyName={agencyName}
        shareable={shareable}
      />
    </Card>
  );
}

/** The client's Instagram: the account you connected for them, or a marked demo until then. */
async function InstagramTab({ userId, clientId, sp, today, tz }: { userId: number; clientId: number; sp: SP; today: string; tz: string }) {
  // Accounts you connected for them, plus the one they connected themselves (when they share Instagram with you).
  const [own, access] = await Promise.all([listAccounts(userId, clientId), clientAccess(userId, clientId)]);
  const theirs = access.link?.shared.includes("instagram") ? (await listAccounts(access.link.clientUserId, clientId)).map((a) => ({ ...a, theirs: true })) : [];
  const accounts = [...own.map((a) => ({ ...a, theirs: false })), ...theirs];
  const picked = accounts.find((a) => String(a.id) === sp.account) ?? accounts[0];
  const q = dashQuery(sp, today);
  const source = picked ? await accountData(picked.theirs ? access.link!.clientUserId : userId, picked.id) : demoData(today);
  const data = buildDashboard({ ...source, from: q.from, to: q.to, kind: q.kind, tz });
  const back = `/clients/${clientId}?tab=instagram`;
  const href = dashHref(`/clients/${clientId}`, { tab: "instagram", account: picked && accounts.length > 1 ? String(picked.id) : undefined }, q);
  return (
    <>
      <IgNotice flag={typeof sp.ig === "string" ? sp.ig : undefined} />
      {accounts.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {accounts.map((a) => (
            <Link key={a.id} href={`/clients/${clientId}?tab=instagram&account=${a.id}`} className="chip" data-tone={a.id === picked?.id ? "blue" : undefined}>
              @{a.username}
            </Link>
          ))}
        </div>
      )}
      {!picked && (
        <Card className="mb-4 flex flex-col gap-2 p-4 text-[14px] text-label-2">
          <p className="text-[15px] font-semibold text-label">Connect their Instagram</p>
          <p>
            Their account must be a <strong>professional</strong> (Business or Creator) account. Connect it here by signing in to their Instagram, or invite them to their
            dashboard so they connect it themselves.
          </p>
        </Card>
      )}
      <InstagramDashboard
        data={data}
        account={picked ? { ...picked } : DEMO_ACCOUNT}
        query={q}
        href={href}
        actions={
          <>
            {picked && !picked.theirs && <IgAccountActions accountId={picked.id} username={picked.username} />}
            {picked?.theirs && <span className="text-[12px] text-label-2">Connected by them · updates daily</span>}
            {instagramConfigured() && (
              <a href={`/api/instagram/connect?for=client:${clientId}&back=${encodeURIComponent(back)}`} className={buttonClass(picked ? "gray" : "filled", "sm")}>
                <Plus size={14} /> {picked ? "Add account" : "Connect their Instagram"}
              </a>
            )}
          </>
        }
      />
    </>
  );
}

function UpdateForm({
  action,
  update,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  update?: { version: string; title: string; notes: string; status: string; date: string | null };
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Version">
          <input name="version" maxLength={50} defaultValue={update?.version} className="field" placeholder="1.4.0" />
        </Field>
        <Field label="Title">
          <input name="title" required maxLength={200} defaultValue={update?.title} className="field" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select name="status" defaultValue={update?.status ?? "planned"} className="field">
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="shipped">Shipped</option>
          </select>
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={update?.date ?? ""} className="field" />
        </Field>
      </div>
      <Field label="What changed">
        <textarea name="notes" rows={7} defaultValue={update?.notes} className="field" placeholder="- New booking flow&#10;- Fixed gallery upload" />
      </Field>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}

async function AppTab({ userId, clientId, appName, googleConnected }: { userId: number; clientId: number; appName: string; googleConnected: boolean }) {
  const db = await getDb();
  const updates = await db
    .select()
    .from(schema.appUpdates)
    .where(and(eq(schema.appUpdates.clientId, clientId), eq(schema.appUpdates.userId, userId)))
    .orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">{appName || "App"} updates</h2>
        <Sheet title="New app update" trigger={<><Plus size={16} /> New update</>} triggerClassName={buttonClass("filled")}>
          <UpdateForm action={createAppUpdate.bind(null, clientId)} submitLabel="Add update" />
        </Sheet>
      </div>
      {updates.length === 0 ? (
        <Empty icon={<Smartphone size={36} />} title="No updates yet">Log each version: what changed, its status and screenshots in Drive.</Empty>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-separator pl-5">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span className="absolute top-5 -left-[27px] size-3 rounded-full border-2 border-bg" style={{ background: STATUS_COLORS[u.status] }} />
              <ContextMenu items={[{ label: "Delete update", destructive: true, confirm: `Delete “${u.title}”? Its Drive files stay in Drive.`, action: deleteAppUpdate.bind(null, u.id) }]}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {u.version && <span className="rounded-md bg-fill px-1.5 py-0.5 font-mono text-[12px] font-semibold">v{u.version.replace(/^v/i, "")}</span>}
                  <h3 className="flex-1 text-[17px] font-semibold">{u.title}</h3>
                  <Pill color={STATUS_COLORS[u.status]}>{statusLabel(u.status)}</Pill>
                  {u.date && <span className="text-[13px] text-label-2">{u.date}</span>}
                  <Sheet title="Edit update" trigger={<Pencil size={15} />} triggerLabel={`Edit ${u.title}`} triggerClassName="cursor-pointer rounded-full p-1.5 text-label-2 hover:bg-fill">
                    <UpdateForm action={editAppUpdate.bind(null, u.id)} update={u} submitLabel="Save" />
                    <DeleteFooter action={deleteAppUpdate.bind(null, u.id)} message="Delete this update? Its Drive files stay in Drive.">
                      <Trash2 size={15} /> Delete update
                    </DeleteFooter>
                  </Sheet>
                </div>
                {u.notes && <p className="mt-2 text-[14px] whitespace-pre-line text-label-2">{u.notes}</p>}
                <div className="mt-3">
                  <DriveFiles clientId={clientId} section="App" target="appUpdate" targetId={u.id} files={u.files} googleConnected={googleConnected} />
                </div>
              </Card>
              </ContextMenu>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

async function ReelsTab({ userId, clientId }: { userId: number; clientId: number }) {
  const db = await getDb();
  const reels = await db.select().from(schema.reels).where(and(eq(schema.reels.clientId, clientId), eq(schema.reels.userId, userId))).orderBy(desc(schema.reels.updatedAt));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">Reels</h2>
        <Sheet title="New reel" trigger={<><Plus size={16} /> New reel</>} triggerClassName={buttonClass("filled")}>
          <form action={createReel.bind(null, clientId)} className="flex flex-col gap-4">
            <Field label="Working title">
              <input name="title" required maxLength={200} className="field" autoFocus />
            </Field>
            <Field label="Planned post date">
              <input name="postDate" type="date" className="field" />
            </Field>
            <Submit className="self-end">Create and open editor</Submit>
          </form>
        </Sheet>
      </div>
      {reels.length === 0 ? (
        <Empty icon={<Clapperboard size={36} />} title="No reels yet">Each reel gets a script, caption, notes, Drive files and Opus 5.5 as editor.</Empty>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
          {REEL_STATUSES.map((s) => {
            const list = reels.filter((r) => r.status === s);
            return (
              <div key={s} className="w-[220px] shrink-0 snap-start lg:w-auto">
                <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold">
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                  {statusLabel(s)} <span className="font-normal text-label-2">{list.length}</span>
                </p>
                <div className="flex flex-col gap-2">
                  {list.map((r) => (
                    <ContextMenu key={r.id} items={[{ label: "Delete reel", destructive: true, confirm: `Delete “${r.title}”? Its files stay in your Drive.`, action: deleteReel.bind(null, r.id) }]}>
                    <Link href={`/clients/${clientId}/reels/${r.id}`}>
                      <Card className="p-3 transition hover:shadow-lg">
                        <p className="line-clamp-2 text-[14px] font-semibold">{r.title}</p>
                        {(r.hook || r.notes) && <p className="mt-1 line-clamp-3 text-[12px] text-label-2">{r.hook || r.notes}</p>}
                        <p className="mt-2 flex gap-2 text-[11px] text-label-2">
                          {r.postDate && <span>📅 {r.postDate}</span>}
                          {r.files.length > 0 && <span>📎 {r.files.length}</span>}
                        </p>
                      </Card>
                    </Link>
                    </ContextMenu>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

async function CarouselsTab({ userId, clientId }: { userId: number; clientId: number }) {
  const db = await getDb();
  const carousels = await db
    .select()
    .from(schema.carousels)
    .where(and(eq(schema.carousels.clientId, clientId), eq(schema.carousels.userId, userId)))
    .orderBy(desc(schema.carousels.updatedAt));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">Carousels</h2>
        <Sheet title="New carousel" trigger={<><Plus size={16} /> New carousel</>} triggerClassName={buttonClass("filled")}>
          <form action={createCarousel.bind(null, clientId)} className="flex flex-col gap-4">
            <Field label="Title">
              <input name="title" required maxLength={200} className="field" autoFocus />
            </Field>
            <Submit className="self-end">Create and open editor</Submit>
          </form>
        </Sheet>
      </div>
      {carousels.length === 0 ? (
        <Empty icon={<GalleryHorizontalEnd size={36} />} title="No carousels yet">Write and design slides here, and edit them with Claude without switching apps.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {carousels.map((c) => (
            <ContextMenu key={c.id} items={[{ label: "Delete carousel", destructive: true, confirm: `Delete “${c.title}”? Its files stay in your Drive.`, action: deleteCarousel.bind(null, c.id) }]}>
            <Link href={`/clients/${clientId}/carousels/${c.id}`} className="group block">
              <Card className="transition group-hover:shadow-lg">
                <SlidePreview slide={c.slides[0] ?? { heading: "", body: "" }} theme={c.theme} index={0} total={Math.max(1, c.slides.length)} />
                <div className="p-3">
                  <p className="truncate text-[14px] font-semibold">{c.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] text-label-2">
                    <Pill color={STATUS_COLORS[c.status]}>{statusLabel(c.status)}</Pill>
                    {c.slides.length} slides
                  </p>
                </div>
              </Card>
            </Link>
            </ContextMenu>
          ))}
        </div>
      )}
    </>
  );
}
