import Link from "next/link";
import { Board, type BoardWidget } from "@/components/board/board";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import clsx from "clsx";
import {
  ArrowUpRight,
  BarChart3,
  Target,
  Wallet,
  ChevronLeft,
  ChevronRight,
  BookText,
  Clapperboard,
  FileUp,
  Footprints,
  GalleryHorizontalEnd,
  Hourglass,
  Mail,
  ListTodo,
  MessageSquareText,
  Navigation,
  Plus,
  Route as RouteIcon,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Wrench,
} from "lucide-react";
import { CalendarNotices } from "@/components/clash-notice";
import { ClearSuggestions } from "@/components/clear-suggestions";
import { fmtMin, TargetStats, Timeline } from "@/components/day-timeline";
import { TypeIn } from "@/components/type-in";
import { FeedbackCheck, TaskCheck } from "@/components/check";
import { PlanButton } from "@/components/plan-button";
import { MailToTask } from "@/components/mail-actions";
import { BlockContent } from "@/components/custom/blocks";
import { iconFor } from "@/components/custom/icons";
import { listPages, pageItems } from "@/lib/custom-pages-db";
import { Sheet } from "@/components/sheet";
import { Submit } from "@/components/submit";
import { TaskForm } from "@/components/task-form";
import { CountUp } from "@/components/count-up";
import { OpenLink, Tile as SharedTile, Widget as SharedWidget } from "@/components/tile";
import { buttonClass, Chip, Field, Pill, RouteTimeline, STATUS_COLORS, statusLabel } from "@/components/ui";
import { resetHomeBoard, saveHomeBoard } from "@/app/actions/board";
import { boardIds, HOME_BOARD_KEY, normalizeLayout } from "@/lib/board";
import { HOME_WIDGETS, homeDefault, pageBlockWidget, type HomeWidget } from "@/lib/home-widgets";
import { quickAddAppUpdate, quickAddCarousel, quickAddReel } from "@/app/actions/clients";
import { addFeedback } from "@/app/actions/feedback";
import { importPromptFiles } from "@/app/actions/prompts";
import { createTask } from "@/app/actions/tasks";
import { claudeAvailable } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { gmailConnected, listInbox } from "@/lib/google/gmail";
import type { ModuleKey } from "@/lib/modules";
import { KIND_COLORS } from "@/lib/kinds";
import { nowAndNext } from "@/lib/now-next";
import { mapsAvailable } from "@/lib/google/maps";
import { liveNowAndNext, routeForDay } from "@/lib/route";
import { RouteMap } from "@/components/route-map";
import { Bars, Meter, Sparkline } from "@/components/charts";
import { loadFinance } from "@/lib/finance";
import { formatMoney } from "@/lib/fx-math";
import { GOAL_METRICS, goalProgress, loadGoals, loadPosts, needsNumbers, summarize } from "@/lib/marketing";
import { getPlanAdvice, getSetting, getSettings } from "@/lib/settings";
import { addDays, clock, fmtDate, toMin, WEEKDAYS } from "@/lib/time";
import { countSuggestions, getWeek, nowMinutesIn, todayIn, type DayView } from "@/lib/week";

export const metadata = { title: "Home" };

const IN_PROGRESS_REEL = ["scripting", "filming", "editing"];
const daysSince = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));

/** A widget's place in the board's entrance animation. */
type Placed = { i: number };

/** Home's tiles are the shared ones, placed by their entrance order. */
const Tile = ({ i, className, children }: Placed & { className?: string; children: React.ReactNode }) => (
  <SharedTile i={i} className={className}>
    {children}
  </SharedTile>
);
const Widget = (props: Placed & React.ComponentProps<typeof SharedWidget>) => <SharedWidget {...props} />;

/** A big number with its name and a short line under it; the whole tile opens the page behind it. */
function Stat({
  label,
  value,
  sub,
  icon: Icon,
  href,
  ...placed
}: Placed & { label: string; value: number; sub: React.ReactNode; icon: React.ComponentType<{ size?: number; className?: string }>; href: string; accent?: boolean }) {
  return (
    <Tile {...placed} className="justify-between gap-3">
      <Link href={href} className="absolute inset-0 z-[1] rounded-[22px]" aria-label={`${label}: ${value}`} />
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <Icon size={16} className="shrink-0 text-label-2" />
        <span className="truncate">{label}</span>
      </p>
      <div>
        <p className="text-[32px] leading-none font-semibold tracking-[-0.03em]">
          <CountUp value={value} />
        </p>
        <p className="mt-1.5 truncate text-[12px] text-label-2">{sub}</p>
      </div>
    </Tile>
  );
}

/** Minutes of fixed things in a day: calendar events and accepted blocks. */
function busyMinutes(d: DayView) {
  let m = 0;
  for (const e of d.events) m += e.endMin - e.startMin;
  for (const b of d.blocks) if (b.status === "accepted") m += toMin(b.end) - toMin(b.start);
  return m;
}


function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[14px] text-label-2">{children}</p>;
}

export default async function HomePage() {
  const user = await requireUser();
  const on = (m: ModuleKey) => user.modules.includes(m);

  const db = await getDb();
  const settings = await getSettings(user.id);

  // The board first: which widgets this person can use and which are on their Home, so only those load their data.
  const [pages, mapsOn, savedBoard] = await Promise.all([listPages(user.id), mapsAvailable(user.id), getSetting<unknown>(user.id, HOME_BOARD_KEY)]);
  const pageBlocks = pages.flatMap((page) =>
    page.spec.blocks.filter((b) => b.type === "stats" || b.type === "upcoming").map((block) => ({ page, block, widget: pageBlockWidget(page.id, block.id, `${page.title} · ${block.title}`) })),
  );
  const catalogue: HomeWidget[] = [
    ...HOME_WIDGETS.filter((w) => (!w.needs || on(w.needs)) && (!w.needsMaps || mapsOn)),
    ...pageBlocks.map((b) => b.widget),
  ];
  const board = normalizeLayout(
    savedBoard,
    catalogue,
    homeDefault({ clients: on("clients"), email: on("email"), maps: mapsOn, pageBlocks: pageBlocks.filter((b) => b.block.home).map((b) => b.widget.id) }),
  );
  const onBoard = new Set(boardIds(board));
  const shows = (...ids: string[]) => ids.some((id) => onBoard.has(id));

  const today = todayIn(settings.timezone);
  const now = nowMinutesIn(settings.timezone);
  const [{ days, calendarError, googleConnected }, tasks, clients, reels, carousels, updates, feedback, advice, suggestions, promptCount, claudeConfigured] =
    await Promise.all([
      getWeek(user.id, today, 7),
      db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, user.id), eq(schema.tasks.done, false))).orderBy(asc(schema.tasks.due), desc(schema.tasks.priority)),
      db.select().from(schema.clients).where(and(eq(schema.clients.userId, user.id), eq(schema.clients.archived, false))).orderBy(asc(schema.clients.name)),
      db.select().from(schema.reels).where(and(eq(schema.reels.userId, user.id), ne(schema.reels.status, "posted"))).orderBy(desc(schema.reels.updatedAt)),
      db.select().from(schema.carousels).where(and(eq(schema.carousels.userId, user.id), ne(schema.carousels.status, "posted"))).orderBy(desc(schema.carousels.updatedAt)),
      db.select().from(schema.appUpdates).where(eq(schema.appUpdates.userId, user.id)).orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id)),
      db.select().from(schema.clientFeedback).where(and(eq(schema.clientFeedback.userId, user.id), eq(schema.clientFeedback.status, "open"))).orderBy(desc(schema.clientFeedback.createdAt)),
      getPlanAdvice(user.id),
      countSuggestions(user.id),
      db.select({ id: schema.prompts.id }).from(schema.prompts).where(eq(schema.prompts.userId, user.id)),
      claudeAvailable(user.id),
    ]);
  // Marketing and money (the Clients section): this month at a glance.
  const biz = on("clients") && shows("views", "money", "goals", "needs-numbers", "waiting-money")
    ? await Promise.all([loadPosts(user.id), loadFinance(user.id, today, settings.moneyCurrency), loadGoals(user.id), needsNumbers(user.id)]).then(([posts, money, goals, todo]) => ({
        posts,
        m: summarize(posts, today),
        money,
        goals,
        todo,
      }))
    : null;
  // Blocks of the person's own pages that are on the board.
  const homeBlocks = await Promise.all(
    pageBlocks.filter((b) => onBoard.has(b.widget.id)).map(async ({ page, block, widget }) => ({ page, block, widget, items: await pageItems(user.id, page.id) })),
  );
  // Email tile: a few unread mails from the primary inbox (only when Gmail is connected).
  const gmail = on("email") && shows("inbox") && (await gmailConnected(user.id));
  const inbox = gmail ? await listInbox(user.id, { max: 5, q: "in:inbox is:unread" }).catch(() => null) : null;

  const day = days[0];
  const routeOpts = { tz: settings.timezone, mode: settings.travelMode };
  const [{ current, next, leaveBy, live }, route] = await Promise.all([
    mapsOn && shows("hero") ? liveNowAndNext(user.id, day, now, settings.travel, routeOpts) : { ...nowAndNext(day, now, settings.travel), live: false },
    mapsOn && shows("route") ? routeForDay(user.id, day, routeOpts).catch(() => null) : null,
  ]);
    const target = advice?.dailyTargets.find((t) => t.date === today);
  const client = (id: number) => clients.find((c) => c.id === id);
  const activeClientIds = new Set(clients.map((c) => c.id));
  const visible = <T extends { clientId: number }>(rows: T[]) => rows.filter((r) => activeClientIds.has(r.clientId));

  const myReels = visible(reels);
  const myCarousels = visible(carousels);
  const currentWork = [
    ...myReels.filter((r) => IN_PROGRESS_REEL.includes(r.status)).map((r) => ({ type: "reel" as const, row: r })),
    ...myCarousels.filter((c) => c.status === "draft").map((c) => ({ type: "carousel" as const, row: c })),
    ...visible(updates).filter((u) => u.status === "in_progress").map((u) => ({ type: "appUpdate" as const, row: u })),
  ];
  const waiting = [
    ...myReels.filter((r) => r.status === "review").map((r) => ({ type: "reel" as const, row: r })),
    ...myCarousels.filter((c) => c.status === "review").map((c) => ({ type: "carousel" as const, row: c })),
  ].sort((a, b) => a.row.updatedAt.getTime() - b.row.updatedAt.getTime());
  const latestUpdates = clients.filter((c) => c.appName).map((c) => ({ client: c, update: updates.find((u) => u.clientId === c.id) ?? null }));

  const itemHref = (type: "reel" | "carousel" | "appUpdate", row: { id: number; clientId: number }) =>
    type === "reel" ? `/clients/${row.clientId}/reels/${row.id}` : type === "carousel" ? `/clients/${row.clientId}/carousels/${row.id}` : `/clients/${row.clientId}?tab=app`;
  const itemTitle = (type: string, id: number | null) => {
    if (!id) return null;
    const row = type === "reel" ? reels.find((r) => r.id === id) : type === "carousel" ? carousels.find((c) => c.id === id) : updates.find((u) => u.id === id);
    return row?.title ?? null;
  };
  const TypeIcon = ({ type }: { type: string }) =>
    type === "reel" ? <Clapperboard size={15} /> : type === "carousel" ? <GalleryHorizontalEnd size={15} /> : <Smartphone size={15} />;

  const hour = Math.floor(now / 60);
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = fmtDate(today, { weekday: "long", day: "numeric", month: "long" });

  // ── Widgets ────────────────────────────────────────────────
  const routeTile = (p: Placed) => (
    <Widget {...p} title="Today's route" icon={RouteIcon} href="/today">
      {route && <RouteMap route={route} />}
    </Widget>
  );
  const tasksDue = (p: Placed) => (
    <Widget {...p}
      title="Tasks due soon"
      icon={ListTodo}
      href="/today"
      action={
        <Sheet title="New task" trigger={<Plus size={16} />} triggerLabel="New task" triggerClassName="grid size-8 cursor-pointer place-items-center rounded-full bg-accent-soft text-accent transition hover:bg-ink hover:text-on-ink">
          <TaskForm action={createTask} clients={clients} />
        </Sheet>
      }
    >
      {tasks.length === 0 ? (
        <EmptyLine>No open tasks.</EmptyLine>
      ) : (
        <ul className="space-y-2">
          {tasks.slice(0, 5).map((t) => {
            const overdue = t.due && t.due < today;
            return (
              <li key={t.id} className="flex items-start gap-2.5">
                <TaskCheck id={t.id} done={false} label={t.title} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{t.title}</p>
                  <p className="text-[12px] text-label-2">
                    {t.due ? <span className={overdue ? "font-semibold text-red" : ""}>{t.due === today ? "Due today" : overdue ? `Overdue (${t.due})` : `Due ${t.due}`}</span> : "No due date"}
                    {t.clientId && client(t.clientId) && ` · ${client(t.clientId)!.name}`}
                  </p>
                </div>
              </li>
            );
          })}
          {tasks.length > 5 && <li className="text-[13px] text-label-2">+{tasks.length - 5} more on Today</li>}
        </ul>
      )}
    </Widget>
  );

  const quickAdd = (p: Placed) => (
    <Widget {...p} title="Quick add" icon={Plus}>
      <div className="grid grid-cols-2 gap-2">
        <Sheet title="New task" trigger={<><ListTodo size={15} /> Task</>} triggerClassName={buttonClass("gray", "sm") + " w-full whitespace-nowrap"}>
          <TaskForm action={createTask} clients={clients} />
        </Sheet>
        <Sheet title="New reel" trigger={<><Clapperboard size={15} /> Reel</>} triggerClassName={buttonClass("gray", "sm") + " w-full whitespace-nowrap"}>
          <form action={quickAddReel} className="flex flex-col gap-4">
            <ClientSelect clients={clients} />
            <Field label="Working title">
              <input name="title" required maxLength={200} className="field" />
            </Field>
            <Field label="Planned post date">
              <input name="postDate" type="date" className="field" />
            </Field>
            <Submit className="self-end">Create and open editor</Submit>
          </form>
        </Sheet>
        <Sheet title="New carousel" trigger={<><GalleryHorizontalEnd size={15} /> Carousel</>} triggerClassName={buttonClass("gray", "sm") + " w-full whitespace-nowrap"}>
          <form action={quickAddCarousel} className="flex flex-col gap-4">
            <ClientSelect clients={clients} />
            <Field label="Title">
              <input name="title" required maxLength={200} className="field" />
            </Field>
            <Submit className="self-end">Create and open editor</Submit>
          </form>
        </Sheet>
        <Sheet title="New app update" trigger={<><Smartphone size={15} /> App update</>} triggerClassName={buttonClass("gray", "sm") + " w-full whitespace-nowrap"}>
          <form action={quickAddAppUpdate} className="flex flex-col gap-4">
            <ClientSelect clients={clients.filter((c) => c.appName)} />
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Field label="Version">
                <input name="version" maxLength={50} className="field" placeholder="1.4.0" />
              </Field>
              <Field label="Title">
                <input name="title" required maxLength={200} className="field" />
              </Field>
            </div>
            <Field label="Status">
              <select name="status" defaultValue="in_progress" className="field">
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="shipped">Shipped</option>
              </select>
            </Field>
            <Field label="What changed">
              <textarea name="notes" rows={4} className="field" />
            </Field>
            <Submit className="self-end">Add update</Submit>
          </form>
        </Sheet>
        <Sheet title="Client feedback" trigger={<><MessageSquareText size={15} /> Feedback</>} triggerClassName={buttonClass("gray", "sm") + " col-span-2 w-full whitespace-nowrap"}>
          <FeedbackForm clients={clients} reels={myReels} carousels={myCarousels} updates={visible(updates)} />
        </Sheet>
      </div>
    </Widget>
  );

  const promptUpload = (p: Placed) => (
    <Widget {...p} title="Your style · prompts" icon={BookText} href="/clients?view=brain#style">
      <p className="mb-3 text-[13px] text-label-2">
        {promptCount.length} saved. Upload .txt or .md files; each file becomes a prompt named after the file.
      </p>
      <form action={importPromptFiles} className="space-y-2">
        <input
          type="file"
          name="files"
          multiple
          required
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          aria-label="Prompt files"
          className="block w-full text-[13px] text-label-2 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-purple/15 file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-purple"
        />
        <div className="flex gap-2">
          <select name="category" defaultValue="reel" aria-label="Used for" className="field !py-1.5 text-[13px]">
            <option value="reel">For reels</option>
            <option value="carousel">For carousels</option>
            <option value="general">General</option>
          </select>
          <Submit size="sm" className="shrink-0">
            <FileUp size={14} /> Upload
          </Submit>
        </div>
      </form>
      <Link href="/clients?view=brain#style" className="mt-2 inline-block text-[13px] font-semibold text-blue">
        Or paste a prompt →
      </Link>
    </Widget>
  );

  const recommended = (p: Placed) => (
    <Widget {...p} title="Recommended today" icon={Sparkles}>
      {target ? (
        <>
          <TargetStats target={target} />
          {target.note && <p className="mt-3 text-[13px] text-label-2">{target.note}</p>}
        </>
      ) : (
        <EmptyLine>&ldquo;Plan my week&rdquo; suggests daily project time here.</EmptyLine>
      )}
    </Widget>
  );

  // The next seven days as a strip of dates; today is the dark pill.
  const monthStrip = (p: Placed) => (
    <Tile {...p}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight">{fmtDate(today, { month: "long", year: "numeric" })}</h2>
        <Link href={`/calendar?week=${addDays(today, -7)}`} aria-label="Previous week" className="grid size-8 place-items-center rounded-full bg-fill text-label-2 transition hover:bg-ink hover:text-on-ink">
          <ChevronLeft size={16} />
        </Link>
        <Link href="/calendar" aria-label="Open calendar" className="grid size-8 place-items-center rounded-full bg-fill text-label-2 transition hover:bg-ink hover:text-on-ink">
          <ChevronRight size={16} />
        </Link>
      </header>
      <div className="grid flex-1 grid-cols-7 content-center gap-1">
        {days.map((d) => {
          const isToday = d.date === today;
          const suggested = d.blocks.filter((b) => b.status === "proposed").length;
          return (
            <Link
              key={d.date}
              href={`/calendar?week=${d.date}`}
              title={suggested ? `${suggested} suggestion${suggested === 1 ? "" : "s"}` : undefined}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 transition-[background-color,transform] duration-300 hover:-translate-y-0.5",
                isToday ? "bg-ink text-on-ink shadow-apple" : "hover:bg-fill",
              )}
            >
              <span className={clsx("text-[11px] font-medium", isToday ? "opacity-70" : "text-label-2")}>{WEEKDAYS[d.weekday - 1].slice(0, 3)}</span>
              <span className="text-[17px] font-semibold tabular-nums">{Number(d.date.slice(8))}</span>
              <span className="flex h-1.5 gap-0.5">
                {d.blocks.some((b) => b.status === "accepted") && <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS.project }} />}
                {d.blocks.some((b) => b.kind === "post") && <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS.post }} />}
                {d.clashes.length > 0 && <span className="size-1.5 rounded-full bg-red" />}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-label-2">
        {[["Planned work", "project"], ["Posting", "post"]].map(([l, k]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS[k] }} /> {l}
          </span>
        ))}
      </p>
    </Tile>
  );

  // Hours of fixed things each day this week, as bars that grow in.
  const busy = days.map(busyMinutes);
  const busyTop = Math.max(8 * 60, ...busy);
  const busyWeek = (p: Placed) => (
    <Tile {...p}>
      <header className="mb-1 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">Busy this week</h2>
        <OpenLink href="/calendar" label="Open calendar" />
      </header>
      <p className="text-[32px] leading-tight font-semibold tracking-[-0.03em]">
        <CountUp value={busy.reduce((a, b) => a + b, 0)} minutes />
      </p>
      <p className="mb-3 text-[12px] text-label-2">Meetings, events and planned work over the next 7 days</p>
      <div className="mt-auto grid h-28 grid-cols-7 items-end gap-2">
        {days.map((d, k) => (
          <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] text-label-2 tabular-nums">{busy[k] ? fmtMin(busy[k]) : ""}</span>
            <span
              className={clsx("bar w-full max-w-9 rounded-full", d.date === today ? "bg-ink" : "bg-accent-soft")}
              style={{ height: `${Math.max(6, (busy[k] / busyTop) * 100)}%`, ["--i" as string]: k }}
            />
            <span className={clsx("text-[11px]", d.date === today ? "font-semibold" : "text-label-2")}>{WEEKDAYS[d.weekday - 1].slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </Tile>
  );

  // The banner: where you are, what's next and when to leave, as a little route.
  const hero = (p: Placed) => (
    <Tile {...p} className="!p-5">
      <div className="flex items-center gap-3">
        <span className="orb-well">
          <Navigation size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-label-2">{current ? "Now" : "Right now"}</p>
          <p className="truncate text-[22px] leading-tight font-semibold tracking-[-0.02em]">
            <TypeIn text={current ? current.title : "Free time"} />
          </p>
        </div>
      </div>
      <div className="mt-5 grid items-center gap-x-6 gap-y-4 @[380px]:grid-cols-[auto_1fr]">
        <div>
          <p className="text-[12px] text-label-2">{next ? "Next in" : "Next"}</p>
          <p className="text-[38px] leading-none font-light tracking-tight tabular-nums">{next ? <CountUp value={Math.max(0, next.start - now)} minutes /> : "—"}</p>
        </div>
        <RouteTimeline
          stops={[
            { title: current ? current.title : "You", sub: current ? `until ${clock(current.end)}` : "free now" },
            next ? { title: next.title, sub: `${clock(next.start)}${next.place !== "any" && next.place !== "online" ? ` · ${next.place}` : ""}` } : { title: "Nothing else today" },
          ]}
        />
      </div>
      {leaveBy != null && (
        <div className="mt-3">
          <Chip icon={<Footprints size={13} />} tone={leaveBy - now <= 15 ? "red" : "orange"}>
            {leaveBy <= now ? "Leave now" : `Leave by ${clock(leaveBy)}`}
            {live && " · live"}
          </Chip>
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-end gap-2 pt-5">
        <PlanButton claudeConfigured={claudeConfigured} />
        <Link href="/today" className={buttonClass("gray")}>
          Open today
        </Link>
      </div>
    </Tile>
  );

  const openFeedback = feedback.filter((f) => activeClientIds.has(f.clientId));
  const dueToday = tasks.filter((t) => t.due && t.due <= today).length;
  const oldestWait = waiting[0] ? daysSince(waiting[0].row.updatedAt) : 0;
  const cur = settings.moneyCurrency;
  const fmtMoney = (c: number) => formatMoney(c, cur, { compact: true });
  const viewsTile = (p: Placed) =>
    biz && (
      <Widget {...p} title="Views this month" icon={BarChart3} href="/clients?view=marketing">
        <p className="text-[32px] leading-none font-semibold tracking-[-0.03em]">
          <CountUp value={biz.m.month.views} />
        </p>
        <p className="mt-1 text-[12px] text-label-2">
          {biz.m.lastMonth.views ? `${biz.m.month.views >= biz.m.lastMonth.views ? "▲" : "▼"} ${Math.abs(Math.round(((biz.m.month.views - biz.m.lastMonth.views) / biz.m.lastMonth.views) * 100))}% vs last month` : `${biz.m.postsThisMonth} posts this month`}
          {" · "}
          {biz.m.engagement.toFixed(1)}% engagement
        </p>
        <Sparkline values={biz.m.weekly} className="mt-3 text-accent" />
      </Widget>
    );
  const moneyTile = (p: Placed) =>
    biz && (
      <Widget {...p} title="Money this month" icon={Wallet} href="/clients?view=finance">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] text-label-2">In</p>
            <p className="text-[22px] font-bold tracking-tight text-green tabular-nums">{fmtMoney(biz.money.incomeThisMonth)}</p>
          </div>
          <div>
            <p className="text-[12px] text-label-2">Out</p>
            <p className="text-[22px] font-bold tracking-tight tabular-nums">{fmtMoney(biz.money.spendThisMonth)}</p>
          </div>
        </div>
        <Bars height={56} labels={biz.money.months.slice(-6).map((m) => fmtDate(`${m}-01`, { month: "narrow" }))} highlight={5} format={fmtMoney} series={[{ label: "In", values: biz.money.income.slice(-6), color: "var(--green)" }, { label: "Out", values: biz.money.spending.slice(-6), color: "var(--accent)" }]} />
        {biz.money.waiting.length > 0 && (
          <div className="mt-2">
            <Chip tone={biz.money.overdue.length ? "red" : "orange"}>
              {fmtMoney(biz.money.waitingTotal)} waiting{biz.money.overdue.length ? ` · ${biz.money.overdue.length} overdue` : ""}
            </Chip>
          </div>
        )}
      </Widget>
    );
  const goalsTile = (p: Placed) =>
    biz && (
      <Widget {...p} title="Goals" icon={Target} href="/clients?view=marketing">
        <div className="flex flex-col gap-3">
          {biz.goals.slice(0, 3).map((g) => (
            <Meter
              key={g.id}
              label={`${GOAL_METRICS.find((x) => x.key === g.metric)?.label} · ${g.period}`}
              value={g.metric === "income" ? biz.money.incomeThisMonth / 100 : goalProgress(g, biz.posts, today)}
              target={g.target}
            />
          ))}
        </div>
      </Widget>
    );
  const needsNumbersTile = (p: Placed) =>
    biz && (
      <Widget {...p} title="Needs numbers" icon={BarChart3} href="/clients?view=marketing">
        <ul className="flex flex-col gap-1.5 text-[14px]">
          {biz.todo.slice(0, 5).map((t) => (
            <li key={`${t.kind}${t.id}`} className="truncate">
              {t.title} <span className="text-label-2">· {t.kind}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-label-2">Marked Posted; add their views and likes.</p>
      </Widget>
    );
  const waitingMoneyTile = (p: Placed) =>
    biz && (
      <Widget {...p} title="Waiting payments" icon={Wallet} href="/clients?view=finance">
        <p className="text-[26px] font-bold tracking-tight tabular-nums">{fmtMoney(biz.money.waitingTotal)}</p>
        <ul className="mt-1 flex flex-col gap-1 text-[13px]">
          {biz.money.waiting.slice(0, 4).map((r) => (
            <li key={r.id} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">{client(r.clientId ?? -1)?.name || r.note || "Payment"}</span>
              <span className={r.due && r.due < today ? "font-semibold text-red" : "text-label-2"}>{r.due ? fmtDate(r.due, { day: "numeric", month: "short" }) : ""}</span>
            </li>
          ))}
        </ul>
      </Widget>
    );

  const stats = {
    tasks: (p: Placed) => (
      <Stat {...p} accent label="Open tasks" value={tasks.length} icon={ListTodo} href="/today" sub={dueToday ? `${dueToday} due today or overdue` : "Nothing due today"} />
    ),
    work: (p: Placed) => (
      <Stat {...p} label="In progress" value={currentWork.length} icon={Wrench} href="/clients" sub="Reels, carousels and app updates" />
    ),
    review: (p: Placed) => (
      <Stat {...p} label="Waiting on review" value={waiting.length} icon={Hourglass} href="/clients" sub={waiting.length ? `Oldest sent ${oldestWait}d ago` : "Nothing sent"} />
    ),
    feedback: (p: Placed) => (
      <Stat {...p} label="Feedback to fix" value={openFeedback.length} icon={MessageSquareText} href="/clients" sub="Open client notes" />
    ),
    clients: (p: Placed) => (
      <Stat {...p} label="Active clients" value={clients.length} icon={Clapperboard} href="/clients" sub={`${myReels.length} reels · ${myCarousels.length} carousels open`} />
    ),
    suggestions: (p: Placed) => (
      <Stat {...p} label="Suggestions" value={suggestions} icon={Sparkles} href="/calendar" sub="From Plan my week, waiting for you" />
    ),
  };

  const inboxTile = (p: Placed) => (
    <Widget {...p} title="Inbox" icon={Mail} href="/email">
      {!gmail ? (
        <EmptyLine>
          <a href="/api/auth/google?gmail=1" className="font-semibold text-accent">Connect Gmail</a> to see unread mail here, reply and turn emails into tasks.
        </EmptyLine>
      ) : !inbox ? (
        <EmptyLine>Couldn&apos;t load your inbox right now.</EmptyLine>
      ) : inbox.length === 0 ? (
        <EmptyLine>No unread mail. Nice.</EmptyLine>
      ) : (
        <ul className="space-y-1">
          {inbox.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <Link href={`/email?m=${m.id}`} className="min-w-0 flex-1 rounded-lg px-1 py-1 hover:bg-fill">
                <p className="truncate text-[14px] font-medium">{m.subject}</p>
                <p className="truncate text-[12px] text-label-2">{m.from}</p>
              </Link>
              <MailToTask id={m.id} subject={m.subject} compact />
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );

  const scheduleShortcuts = (p: Placed) => (
    <Widget {...p} title="Shortcuts" icon={Sun}>
      <div className="flex flex-col gap-2">
        <PlanButton claudeConfigured={claudeConfigured} />
        <ClearSuggestions count={suggestions} />
        <div className="grid grid-cols-2 gap-2">
          <Link href="/today" className={buttonClass("gray", "sm")}>Today</Link>
          <Link href="/calendar" className={buttonClass("gray", "sm")}>Calendar</Link>
        </div>
      </div>
    </Widget>
  );

  const todayTimeline = (p: Placed) => (
    <Widget {...p} title="Today" icon={Sun} href="/today">
      <div className="-mx-4 -mb-4 [&>*]:rounded-none [&>*]:shadow-none">
        <Timeline day={day} now={now} />
      </div>
    </Widget>
  );

  const currentWorkW = (p: Placed) => (
    <Widget {...p} title="Current work" icon={Wrench}>
      {currentWork.length === 0 ? (
        <EmptyLine>Nothing in progress. Reels being scripted, filmed or edited, draft carousels and app updates in progress show here.</EmptyLine>
      ) : (
        <ul className="divide-y divide-separator">
          {currentWork.map(({ type, row }) => (
            <li key={`${type}${row.id}`}>
              <Link href={itemHref(type, row)} className="flex items-center gap-2.5 py-2 hover:bg-fill/60">
                <span className="text-label-2">
                  <TypeIcon type={type} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{row.title}</span>
                <span className="hidden items-center gap-1 text-[12px] text-label-2 sm:flex">
                  <span className="size-2 rounded-full" style={{ background: client(row.clientId)?.color }} />
                  {client(row.clientId)?.name}
                </span>
                <Pill color={STATUS_COLORS[row.status]}>{statusLabel(row.status)}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );

  const waitingW = (p: Placed) => (
    <Widget {...p} title="Waiting on client review" icon={Hourglass}>
      {waiting.length === 0 ? (
        <EmptyLine>Nothing waiting. Set an item to &ldquo;Review&rdquo; when you send it.</EmptyLine>
      ) : (
        <ul className="space-y-2.5">
          {waiting.map(({ type, row }) => (
            <li key={`${type}${row.id}`} className="flex items-center gap-2">
              <Link href={itemHref(type, row)} className="flex min-w-0 flex-1 items-center gap-2 hover:text-blue">
                <span className="text-label-2">
                  <TypeIcon type={type} />
                </span>
                <span className="truncate text-[14px]">{row.title}</span>
              </Link>
              <span className={clsx("text-[12px]", daysSince(row.updatedAt) >= 3 ? "font-semibold text-orange" : "text-label-2")}>
                {daysSince(row.updatedAt) === 0 ? "sent today" : `${daysSince(row.updatedAt)}d`}
              </span>
              <Sheet
                title={`Feedback · ${row.title}`}
                trigger={<MessageSquareText size={15} />}
                triggerLabel={`Log feedback for ${row.title}`}
                triggerClassName="rounded-full p-1.5 text-label-2 hover:bg-fill hover:text-label"
              >
                <form action={addFeedback} className="flex flex-col gap-4">
                  <input type="hidden" name="target" value={`${type}:${row.id}`} />
                  <Field label="What did the client say? What needs changing?">
                    <textarea name="note" required rows={5} className="field" />
                  </Field>
                  <Submit className="self-end">Save feedback</Submit>
                </form>
              </Sheet>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );

  const feedbackW = (p: Placed) => (
    <Widget {...p}
      title="Client feedback"
      icon={MessageSquareText}
      action={
        <Sheet title="Client feedback" trigger={<Plus size={16} />} triggerLabel="Add client feedback" triggerClassName="grid size-8 cursor-pointer place-items-center rounded-full bg-accent-soft text-accent transition hover:bg-ink hover:text-on-ink">
          <FeedbackForm clients={clients} reels={myReels} carousels={myCarousels} updates={visible(updates)} />
        </Sheet>
      }
    >
      {feedback.length === 0 ? (
        <EmptyLine>No open feedback. Log what a client says so you don&apos;t forget to change it.</EmptyLine>
      ) : (
        <ul className="space-y-3">
          {feedback.map((f) => {
            const title = f.targetType ? itemTitle(f.targetType, f.targetId) : null;
            const c = client(f.clientId);
            return (
              <li key={f.id} className="flex gap-2.5">
                <FeedbackCheck id={f.id} done={false} label={f.note.slice(0, 40)} />
                <div className="min-w-0">
                  <p className="text-[14px] whitespace-pre-line">{f.note}</p>
                  <p className="mt-0.5 text-[12px] text-label-2">
                    {c?.name}
                    {title && f.targetType && f.targetId && (
                      <>
                        {" · "}
                        <Link
                          href={itemHref(f.targetType as "reel" | "carousel" | "appUpdate", { id: f.targetId, clientId: f.clientId })}
                          className="text-blue"
                        >
                          {title}
                        </Link>
                      </>
                    )}
                    {" · "}
                    {daysSince(f.createdAt) === 0 ? "today" : `${daysSince(f.createdAt)}d ago`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );

  const pipeline = (p: Placed) => (
    <Widget {...p} title="Content in progress" icon={Clapperboard} href="/clients">
      {clients.length === 0 ? (
        <EmptyLine>No clients yet.</EmptyLine>
      ) : (
        <ul className="space-y-3">
          {clients.map((c) => {
            const r = myReels.filter((x) => x.clientId === c.id);
            const k = myCarousels.filter((x) => x.clientId === c.id);
            const statuses = [...new Set([...r, ...k].map((x) => x.status))];
            return (
              <li key={c.id}>
                <Link href={`/clients/${c.id}?tab=content`} className="flex items-center gap-2 text-[14px] font-medium hover:text-blue">
                  <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  <span className="ml-auto text-[12px] font-normal text-label-2">
                    {r.length} reels · {k.length} carousels
                  </span>
                </Link>
                {statuses.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
                    {statuses.map((s) => (
                      <Pill key={s} color={STATUS_COLORS[s]}>
                        {[...r, ...k].filter((x) => x.status === s).length} {statusLabel(s).toLowerCase()}
                      </Pill>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );

  const appUpdatesW = (p: Placed) => (
    <Widget {...p} title="Latest app updates" icon={Smartphone}>
      {latestUpdates.length === 0 ? (
        <EmptyLine>No client apps yet.</EmptyLine>
      ) : (
        <ul className="space-y-2.5">
          {latestUpdates.map(({ client: c, update: u }) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}?tab=app`} className="block rounded-lg px-1 hover:bg-fill">
                <p className="flex items-center gap-1.5 text-[12px] text-label-2">
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.appName}
                </p>
                {u ? (
                  <p className="flex items-center gap-2 text-[14px]">
                    {u.version && <span className="font-mono text-[12px] font-semibold">v{u.version.replace(/^v/i, "")}</span>}
                    <span className="min-w-0 flex-1 truncate">{u.title}</span>
                    <Pill color={STATUS_COLORS[u.status]}>{statusLabel(u.status)}</Pill>
                  </p>
                ) : (
                  <p className="text-[14px] text-label-2">No updates logged yet</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );

  // Every widget, rendered only when it's on the board (the library adds one, saves, and the page renders it).
  const builders: Record<string, (p: Placed) => React.ReactNode> = {
    hero,
    "stat-tasks": stats.tasks,
    "stat-suggestions": stats.suggestions,
    "stat-work": stats.work,
    "stat-review": stats.review,
    "stat-feedback": stats.feedback,
    "stat-clients": stats.clients,
    week: monthStrip,
    tasks: tasksDue,
    today: todayTimeline,
    busy: busyWeek,
    recommended,
    shortcuts: scheduleShortcuts,
    route: routeTile,
    inbox: inboxTile,
    "current-work": currentWorkW,
    waiting: waitingW,
    feedback: feedbackW,
    pipeline,
    "app-updates": appUpdatesW,
    "quick-add": quickAdd,
    prompts: promptUpload,
    views: viewsTile,
    money: moneyTile,
    "waiting-money": waitingMoneyTile,
    goals: goalsTile,
    "needs-numbers": needsNumbersTile,
  };
  for (const { page, block, widget, items } of homeBlocks)
    builders[widget.id] = (p: Placed) => (
      <Widget {...p} title={widget.title} icon={iconFor(page.icon)} href={`/p/${page.slug}`}>
        <BlockContent pageId={page.id} spec={page.spec} items={items} today={today} block={block} />
      </Widget>
    );
  const widgets: Record<string, React.ReactNode> = {};
  boardIds(board).forEach((id, i) => {
    if (builders[id]) widgets[id] = builders[id]({ i });
  });
  const icons: Record<string, React.ComponentType<{ size?: number }>> = {
    hero: Navigation, "stat-tasks": ListTodo, "stat-suggestions": Sparkles, "stat-work": Wrench, "stat-review": Hourglass, "stat-feedback": MessageSquareText,
    "stat-clients": Clapperboard, week: ChevronRight, tasks: ListTodo, today: Sun, busy: BarChart3, recommended: Sparkles, shortcuts: Sun, route: RouteIcon,
    inbox: Mail, "current-work": Wrench, waiting: Hourglass, feedback: MessageSquareText, pipeline: Clapperboard, "app-updates": Smartphone, "quick-add": Plus,
    prompts: BookText, views: BarChart3, money: Wallet, "waiting-money": Wallet, goals: Target, "needs-numbers": BarChart3,
  };
  const library: BoardWidget[] = catalogue.map(({ title, hint, group, ...def }) => {
    const Icon = icons[def.id] ?? (pageBlocks.find((b) => b.widget.id === def.id) ? iconFor(pageBlocks.find((b) => b.widget.id === def.id)!.page.icon) : Sparkles);
    return { def: { id: def.id, size: def.size, min: def.min, max: def.max, phoneW: def.phoneW, phoneH: def.phoneH, tabletH: def.tabletH }, title, hint, group, icon: <Icon size={17} /> };
  });

  return (
    <>
      <Board
        notice={
          <CalendarNotices
            days={days}
            googleConnected={googleConnected}
            calendarError={calendarError}
            notConnected={<>Google isn&apos;t connected. <Link href="/settings" className="font-semibold text-blue">Connect in Settings</Link></>}
          />
        }
        widgets={widgets}
        catalogue={library}
        layout={board}
        save={saveHomeBoard}
        reset={resetHomeBoard}
        resetLabel="Reset to default"
        header={
          <div className="flex items-end justify-between gap-3 pt-1">
            <div className="min-w-0">
              <p className="mb-0.5 text-[13px] text-label-2">{dateLabel}</p>
              <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em]">
                {greeting}
                {settings.displayName ? `, ${settings.displayName}` : ""}
              </h1>
            </div>
            <Link href="/settings" aria-label="Settings" className="chrome grid size-10 shrink-0 place-items-center rounded-full text-label-2 md:hidden">
              <Settings size={18} />
            </Link>
          </div>
        }
      />
    </>
  );
}

function ClientSelect({ clients }: { clients: { id: number; name: string }[] }) {
  return (
    <Field label="Client">
      <select name="clientId" required defaultValue={clients[0]?.id} className="field">
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FeedbackForm({
  clients,
  reels,
  carousels,
  updates,
}: {
  clients: { id: number; name: string }[];
  reels: { id: number; clientId: number; title: string }[];
  carousels: { id: number; clientId: number; title: string }[];
  updates: { id: number; clientId: number; title: string }[];
}) {
  return (
    <form action={addFeedback} className="flex flex-col gap-4">
      <ClientSelect clients={clients} />
      <Field label="About (optional)" hint="Picking an item files the note under that item's client.">
        <select name="target" defaultValue="" className="field">
          <option value="">General feedback</option>
          {clients.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {reels.filter((r) => r.clientId === c.id).map((r) => (
                <option key={`r${r.id}`} value={`reel:${r.id}`}>
                  Reel · {r.title}
                </option>
              ))}
              {carousels.filter((r) => r.clientId === c.id).map((r) => (
                <option key={`c${r.id}`} value={`carousel:${r.id}`}>
                  Carousel · {r.title}
                </option>
              ))}
              {updates.filter((r) => r.clientId === c.id).map((r) => (
                <option key={`u${r.id}`} value={`appUpdate:${r.id}`}>
                  App update · {r.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="What did the client say? What needs changing?">
        <textarea name="note" required rows={5} className="field" />
      </Field>
      <Submit className="self-end">Save feedback</Submit>
    </form>
  );
}
