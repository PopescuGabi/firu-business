import Link from "next/link";
import { SegmentedLinks, Slide } from "@/components/motion";
import { asc, desc, eq, ne } from "drizzle-orm";
import clsx from "clsx";
import {
  ArrowRight,
  BookText,
  CalendarDays,
  Clapperboard,
  Clock,
  Dumbbell,
  FileUp,
  GalleryHorizontalEnd,
  Hourglass,
  LayoutGrid,
  ListTodo,
  MessageSquareText,
  Plus,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  Wrench,
} from "lucide-react";
import { CalendarNotices } from "@/components/clash-notice";
import { ClearSuggestions } from "@/components/clear-suggestions";
import { fmtMin, TargetStats, Timeline } from "@/components/day-timeline";
import { FeedbackCheck, TaskCheck } from "@/components/check";
import { PlanButton } from "@/components/plan-button";
import { Sheet } from "@/components/sheet";
import { Submit } from "@/components/submit";
import { TaskForm } from "@/components/task-form";
import { buttonClass, Field, Pill, STATUS_COLORS, statusLabel } from "@/components/ui";
import { quickAddAppUpdate, quickAddCarousel, quickAddReel } from "@/app/actions/clients";
import { addFeedback } from "@/app/actions/feedback";
import { importPromptFiles } from "@/app/actions/prompts";
import { createTask } from "@/app/actions/tasks";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { KIND_COLORS } from "@/lib/kinds";
import { nowAndNext } from "@/lib/now-next";
import { getPlanAdvice, getSettings } from "@/lib/settings";
import { clock, fmtDate, WEEKDAYS } from "@/lib/time";
import { countSuggestions, getWeek, nowMinutesIn, todayIn } from "@/lib/week";

export const metadata = { title: "Home" };

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "work", label: "Work", icon: Wrench },
] as const;
type Tab = (typeof TABS)[number]["key"];

const IN_PROGRESS_REEL = ["scripting", "filming", "editing"];
const daysSince = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));

/** An iOS-style widget: small coloured icon + title, optional link out. */
function Widget({
  title,
  icon: Icon,
  color,
  href,
  action,
  wide,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  href?: string;
  action?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("flex flex-col rounded-2xl bg-card p-4 shadow-apple", wide && "md:col-span-2")}>
      <header className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: color }}>
          <Icon size={15} />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
        {action}
        {href && (
          <Link href={href} aria-label={`Open ${title}`} className="rounded-full p-1 text-label-2 hover:bg-fill hover:text-label">
            <ArrowRight size={16} />
          </Link>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[14px] text-label-2">{children}</p>;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "overview";

  const db = await getDb();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const now = nowMinutesIn(settings.timezone);
  const [{ days, calendarError, googleConnected }, tasks, clients, reels, carousels, updates, feedback, advice, suggestions, promptCount] =
    await Promise.all([
      getWeek(today, 7),
      db.select().from(schema.tasks).where(eq(schema.tasks.done, false)).orderBy(asc(schema.tasks.due), desc(schema.tasks.priority)),
      db.select().from(schema.clients).where(eq(schema.clients.archived, false)).orderBy(asc(schema.clients.name)),
      db.select().from(schema.reels).where(ne(schema.reels.status, "posted")).orderBy(desc(schema.reels.updatedAt)),
      db.select().from(schema.carousels).where(ne(schema.carousels.status, "posted")).orderBy(desc(schema.carousels.updatedAt)),
      db.select().from(schema.appUpdates).orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id)),
      db.select().from(schema.clientFeedback).where(eq(schema.clientFeedback.status, "open")).orderBy(desc(schema.clientFeedback.createdAt)),
      getPlanAdvice(),
      countSuggestions(),
      db.select({ id: schema.prompts.id }).from(schema.prompts),
    ]);

  const day = days[0];
  const { current, next, leaveBy } = nowAndNext(day, now, settings.travel);
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
  const nowNext = (
    <Widget title="Now & next" icon={Clock} color="var(--red)" href="/today" wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-fill/60 p-3">
          <p className="text-[12px] font-semibold text-label-2 uppercase">Now</p>
          {current ? (
            <>
              <p className="mt-0.5 text-[17px] font-semibold">{current.title}</p>
              <p className="text-[13px] text-label-2">until {clock(current.end)}</p>
            </>
          ) : (
            <p className="mt-0.5 text-[17px] font-semibold">Free time</p>
          )}
        </div>
        <div className="rounded-xl bg-fill/60 p-3">
          <p className="text-[12px] font-semibold text-label-2 uppercase">Next</p>
          {next ? (
            <>
              <p className="mt-0.5 text-[17px] font-semibold">{next.title}</p>
              <p className="text-[13px] text-label-2">
                at {clock(next.start)}
                {next.start - now <= 180 && ` · in ${fmtMin(next.start - now)}`}
              </p>
              {leaveBy != null && (
                <p className={clsx("mt-1 text-[13px] font-semibold", leaveBy - now <= 15 ? "text-red" : "text-orange")}>
                  {leaveBy <= now ? "Leave now" : `Leave by ${clock(leaveBy)}`}
                </p>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-[17px] font-semibold">Nothing else today</p>
          )}
        </div>
      </div>
    </Widget>
  );

  const tasksDue = (
    <Widget
      title="Tasks due soon"
      icon={ListTodo}
      color="var(--blue)"
      href="/today"
      action={
        <Sheet title="New task" trigger={<Plus size={16} />} triggerLabel="New task" triggerClassName="rounded-full p-1 text-blue hover:bg-fill">
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

  const waitingReview = (
    <Widget title="Waiting on review" icon={Hourglass} color="var(--yellow)" href="/?tab=work">
      {waiting.length === 0 ? (
        <EmptyLine>Nothing sent for review. Set a reel or carousel to &ldquo;Review&rdquo; when you send it to the client.</EmptyLine>
      ) : (
        <ul className="space-y-2">
          {waiting.slice(0, 4).map(({ type, row }) => (
            <li key={`${type}${row.id}`}>
              <Link href={itemHref(type, row)} className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-fill">
                <span className="text-label-2">
                  <TypeIcon type={type} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{row.title}</span>
                <span className={clsx("text-[12px]", daysSince(row.updatedAt) >= 3 ? "font-semibold text-orange" : "text-label-2")}>
                  {daysSince(row.updatedAt) === 0 ? "today" : `${daysSince(row.updatedAt)}d`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );

  const quickAdd = (
    <Widget title="Quick add" icon={Plus} color="var(--green)">
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

  const promptUpload = (
    <Widget title="Prompts" icon={BookText} color="var(--purple)" href="/prompts">
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
      <Link href="/prompts" className="mt-2 inline-block text-[13px] font-semibold text-blue">
        Or paste a prompt →
      </Link>
    </Widget>
  );

  const recommended = (
    <Widget title="Recommended today" icon={Sparkles} color="var(--indigo)">
      {target ? (
        <>
          <TargetStats target={target} />
          {target.note && <p className="mt-3 text-[13px] text-label-2">{target.note}</p>}
        </>
      ) : (
        <EmptyLine>AI planning (with your API key) suggests daily study, project and gym time here.</EmptyLine>
      )}
    </Widget>
  );

  const weekGlance = (
    <Widget title="Week at a glance" icon={CalendarDays} color="var(--teal)" href="/calendar" wide>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const suggested = d.blocks.filter((b) => b.status === "proposed").length;
          return (
            <Link
              key={d.date}
              href={`/calendar?week=${d.date}`}
              className={clsx("rounded-xl p-2 text-center transition hover:bg-fill", d.date === today ? "bg-blue/12" : "bg-fill/50")}
            >
              <p className="text-[11px] font-semibold text-label-2 uppercase">{WEEKDAYS[d.weekday - 1].slice(0, 3)}</p>
              <p className={clsx("text-[17px] font-semibold", d.date === today && "text-blue")}>{Number(d.date.slice(8))}</p>
              <div className="mt-1 flex min-h-4 flex-wrap justify-center gap-1">
                {d.school.length > 0 && <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS.school }} title="School" />}
                {d.gym && <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS.gym }} title={`Gym · ${d.gym.title}`} />}
                {d.tutoring.map((t) => (
                  <span key={t.id} className="size-1.5 rounded-full" style={{ background: KIND_COLORS.tutoring }} title={`${t.subject} tutoring`} />
                ))}
                {d.clashes.length > 0 && <span className="size-1.5 rounded-full bg-red" title="Travel clash" />}
              </div>
              {suggested > 0 && <p className="mt-0.5 text-[10px] text-label-2">{suggested} sugg.</p>}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-label-2">
        {[["School", "school"], ["Gym", "gym"], ["Tutoring", "tutoring"]].map(([l, k]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: KIND_COLORS[k] }} /> {l}
          </span>
        ))}
      </p>
    </Widget>
  );

  const scheduleShortcuts = (
    <Widget title="Shortcuts" icon={Sun} color="var(--orange)">
      <div className="flex flex-col gap-2">
        <PlanButton claudeConfigured={env.claudeConfigured()} />
        <ClearSuggestions count={suggestions} />
        <div className="grid grid-cols-2 gap-2">
          <Link href="/today" className={buttonClass("gray", "sm")}>Today</Link>
          <Link href="/calendar" className={buttonClass("gray", "sm")}>Calendar</Link>
          <Link href="/school" className={buttonClass("gray", "sm")}>School</Link>
          <Link href="/school" className={buttonClass("gray", "sm")}>
            <Dumbbell size={14} /> Gym split
          </Link>
        </div>
      </div>
    </Widget>
  );

  const todayTimeline = (
    <Widget title="Today" icon={Sun} color="var(--red)" href="/today" wide>
      <div className="-mx-4 -mb-4 [&>*]:rounded-none [&>*]:shadow-none">
        <Timeline day={day} now={now} />
      </div>
    </Widget>
  );

  const currentWorkW = (
    <Widget title="Current work" icon={Wrench} color="var(--blue)" wide>
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

  const waitingW = (
    <Widget title="Waiting on client review" icon={Hourglass} color="var(--yellow)">
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

  const feedbackW = (
    <Widget
      title="Client feedback"
      icon={MessageSquareText}
      color="var(--pink)"
      action={
        <Sheet title="Client feedback" trigger={<Plus size={16} />} triggerLabel="Add client feedback" triggerClassName="rounded-full p-1 text-blue hover:bg-fill">
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

  const pipeline = (
    <Widget title="Content in progress" icon={Clapperboard} color="var(--orange)" href="/clients">
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
                <Link href={`/clients/${c.id}?tab=reels`} className="flex items-center gap-2 text-[14px] font-medium hover:text-blue">
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

  const appUpdatesW = (
    <Widget title="Latest app updates" icon={Smartphone} color="var(--indigo)">
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

  return (
    <>
      <header className="mb-5 flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="text-[13px] font-semibold tracking-wide text-label-2 uppercase">{dateLabel}</p>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight">{greeting}{settings.displayName ? `, ${settings.displayName}` : ""}</h1>
        </div>
        <Link href="/settings" aria-label="Settings" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill text-label-2 md:hidden">
          <Settings size={18} />
        </Link>
      </header>

      <SegmentedLinks
        label="Home sections"
        className="mb-5"
        active={tab}
        items={TABS.map(({ key, label, icon: Icon }) => ({ key, label, href: key === "overview" ? "/" : `/?tab=${key}`, icon: <Icon size={15} /> }))}
      />

      <CalendarNotices
        days={days}
        googleConnected={googleConnected}
        calendarError={calendarError}
        notConnected={<>Google isn&apos;t connected. <Link href="/settings" className="font-semibold text-blue">Connect in Settings</Link></>}
      />

      <Slide group="home-tab" index={TABS.findIndex((t) => t.key === tab)} className="grid grid-flow-row-dense gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tab === "overview" && (
          <>
            {nowNext}
            {tasksDue}
            {waitingReview}
            {quickAdd}
            {promptUpload}
          </>
        )}
        {tab === "schedule" && (
          <>
            {nowNext}
            {recommended}
            {todayTimeline}
            {scheduleShortcuts}
            {weekGlance}
          </>
        )}
        {tab === "work" && (
          <>
            {currentWorkW}
            {waitingW}
            {feedbackW}
            {pipeline}
            {appUpdatesW}
          </>
        )}
      </Slide>
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
