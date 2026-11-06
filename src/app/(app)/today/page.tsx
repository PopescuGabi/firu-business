import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ListTodo, Pencil, Settings, Trash2 } from "lucide-react";
import { fmtMin, TargetStats, Timeline } from "@/components/day-timeline";
import { ClearSuggestions } from "@/components/clear-suggestions";
import { CalendarNotices } from "@/components/clash-notice";
import { PlanButton } from "@/components/plan-button";
import { Sheet } from "@/components/sheet";
import { DeleteFooter } from "@/components/submit";
import { TaskCheck } from "@/components/check";
import { TaskForm } from "@/components/task-form";
import { buttonClass, Card, Chip, Empty, List, PageHeader, Row, RouteTimeline, Section } from "@/components/ui";
import { RouteMap } from "@/components/route-map";
import { RouteAdvice } from "@/components/route-advice";
import { createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { claudeAvailable } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { clock, fmtDate, toHHMM, WEEKDAYS } from "@/lib/time";
import { countSuggestions, getWeek, nowMinutesIn, todayIn } from "@/lib/week";
import { getPlanAdvice, getSettings } from "@/lib/settings";
import { mapsAvailable } from "@/lib/google/maps";
import { liveNowAndNext, routeForDay } from "@/lib/route";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const db = await getDb();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const now = nowMinutesIn(settings.timezone);
  const [{ days, calendarError, googleConnected }, tasks, clients, advice] = await Promise.all([
    getWeek(user.id, today, 7),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, user.id)).orderBy(asc(schema.tasks.done), asc(schema.tasks.due), desc(schema.tasks.priority)),
    db.select().from(schema.clients).where(and(eq(schema.clients.userId, user.id), eq(schema.clients.archived, false))).orderBy(asc(schema.clients.name)),
    getPlanAdvice(user.id),
  ]);
  const day = days[0];
  const mapsOn = await mapsAvailable(user.id);
  const opts = { tz: settings.timezone, mode: settings.travelMode };
  const [route, live] = mapsOn
    ? await Promise.all([routeForDay(user.id, day, opts).catch(() => null), liveNowAndNext(user.id, day, now, settings.travel, opts)])
    : [null, null];
  const target = advice?.dailyTargets.find((t) => t.date === today);
  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done).slice(0, 5);
  const clientName = (id: number | null) => clients.find((c) => c.id === id);
  const hasPending = days.some((d) => d.blocks.some((b) => b.status === "proposed"));

  return (
    <>
      <PageHeader
        subtitle={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })}
        title="Today"
        actions={
          <>
            <ClearSuggestions count={await countSuggestions(user.id)} />
            <PlanButton claudeConfigured={await claudeAvailable(user.id)} />
            <Link href="/settings" aria-label="Settings" className="grid size-9 place-items-center rounded-full bg-fill text-label-2 md:hidden">
              <Settings size={18} />
            </Link>
          </>
        }
      />

      <CalendarNotices
        days={days}
        googleConnected={googleConnected}
        calendarError={calendarError}
        notConnected={
          <>
            Google Calendar isn&apos;t connected yet, so your meetings and other events aren&apos;t shown.{" "}
            <Link href="/settings" className="font-semibold text-blue">Connect in Settings</Link>
          </>
        }
      />

      <div className="grid gap-x-8 lg:grid-cols-[1fr_340px]">
        <div>
          <Section title="Schedule" footer={hasPending ? "Tap ✓ to accept a suggestion, or right-click an event or suggestion to delete it. Accepted blocks go to your Personal Hub calendar when sync is on." : undefined}>
            <Timeline day={day} now={now} />
          </Section>

          <Section
            title="Tasks"
            action={
              <Sheet title="New task" trigger="Add" triggerClassName={buttonClass("plain", "sm")}>
                <TaskForm action={createTask} clients={clients} />
              </Sheet>
            }
          >
            {openTasks.length === 0 ? (
              <Empty icon={<ListTodo size={36} />} title="No open tasks">
                Add tasks for your clients. &ldquo;Plan my week&rdquo; fits them into your free time.
              </Empty>
            ) : (
              <List>
                {openTasks.map((t) => {
                  const c = clientName(t.clientId);
                  const overdue = t.due && t.due < today;
                  return (
                    <Row key={t.id}>
                      <TaskCheck id={t.id} done={t.done} label={t.title} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.title}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-label-2">
                          {t.due && <span className={overdue ? "font-semibold text-red" : ""}>Due {t.due === today ? "today" : t.due}</span>}
                          <span>{fmtMin(t.estimateMin)}</span>
                          {t.priority === 2 && <span className="font-semibold text-orange">High priority</span>}
                          {c && (
                            <span className="inline-flex items-center gap-1">
                              <span className="size-2 rounded-full" style={{ background: c.color }} />
                              {c.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <Sheet title="Edit task" trigger={<Pencil size={15} />} triggerLabel={`Edit ${t.title}`} triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill">
                        <TaskForm action={updateTask.bind(null, t.id)} clients={clients} task={t} submitLabel="Save" />
                        <DeleteFooter action={deleteTask.bind(null, t.id)} message="Delete this task?">
                          <Trash2 size={15} /> Delete task
                        </DeleteFooter>
                      </Sheet>
                    </Row>
                  );
                })}
              </List>
            )}
            {doneTasks.length > 0 && (
              <details className="mt-3 px-4 text-[14px] text-label-2">
                <summary className="cursor-pointer">Completed ({doneTasks.length})</summary>
                <List className="mt-2">
                  {doneTasks.map((t) => (
                    <Row key={t.id}>
                      <TaskCheck id={t.id} done label={t.title} />
                      <span className="truncate text-label-2 line-through">{t.title}</span>
                    </Row>
                  ))}
                </List>
              </details>
            )}
          </Section>
        </div>

        <div>
          {mapsOn && (
            <Section title="Route today">
              <Card className="flex flex-col gap-4 p-3">
                {route ? (
                  <>
                    <RouteMap route={route} />
                    {live?.next && live.leaveBy != null && (
                      <div className="px-1">
                        <Chip tone={live.leaveBy - now <= 15 ? "red" : "orange"}>
                          {live.leaveBy <= now ? "Leave now" : `Leave by ${clock(live.leaveBy)}`} for {live.next.title}
                          {live.live && " · live"}
                        </Chip>
                      </div>
                    )}
                    <RouteTimeline
                      className="px-1"
                      stops={route.stops.map((s, i) => ({
                        title: s.title,
                        sub: [s.start != null && i > 0 ? `from ${clock(s.start)}` : null, s.end != null && i < route.stops.length - 1 ? `leave ${clock(s.end)}` : null, route.legs.find((l) => l.from === s.place && i < route.stops.length - 1) ? `${fmtMin(route.legs.find((l) => l.from === s.place)!.minutes)} to next` : null]
                          .filter(Boolean)
                          .join(" · "),
                        state: i === 0 ? "here" : i === 1 ? "next" : "later",
                      }))}
                    />
                    {route.missing.length > 0 && (
                      <p className="px-1 text-[12px] text-label-2">
                        No address yet for {route.missing.join(", ")}. <Link href="/settings" className="font-semibold text-accent">Add in Settings</Link>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="p-1 text-[14px] text-label-2">
                    Nothing to travel to today, or your places have no addresses yet. <Link href="/settings" className="font-semibold text-accent">Settings → Google Maps</Link>
                  </p>
                )}
                <div className="px-1 pb-1">
                  <RouteAdvice />
                </div>
              </Card>
            </Section>
          )}
          <Section title="Recommended today">
            <Card className="p-4">
              {target ? (
                <>
                  <TargetStats target={target} />
                  {target.note && <p className="mt-3 text-[14px] text-label-2">{target.note}</p>}
                </>
              ) : (
                <p className="text-[14px] text-label-2">
                  Run &ldquo;Plan my week&rdquo; to get recommended project time for each day.
                </p>
              )}
              {advice?.advice && <p className="mt-3 border-t border-separator pt-3 text-[14px]">{advice.advice}</p>}
            </Card>
          </Section>

          <Section title="Next days">
            <List>
              {days.slice(1).map((d) => (
                <Link key={d.date} href={`/calendar?week=${d.date}`} className="block hover:bg-fill">
                  <Row>
                    <div className="w-11 text-center">
                      <p className="text-[11px] font-semibold text-red uppercase">{WEEKDAYS[d.weekday - 1].slice(0, 3)}</p>
                      <p className="text-[20px] leading-tight font-semibold">{Number(d.date.slice(8))}</p>
                    </div>
                    <div className="min-w-0 flex-1 text-[13px] text-label-2">
                      {d.events.length > 0 && <p>{d.events.length} calendar event{d.events.length > 1 ? "s" : ""}</p>}
                      {d.blocks.length > 0 && (
                        <p>
                          {[
                            d.blocks.some((b) => b.status === "accepted") && `${d.blocks.filter((b) => b.status === "accepted").length} planned`,
                            d.blocks.some((b) => b.status === "proposed") && `${d.blocks.filter((b) => b.status === "proposed").length} suggested`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {!d.events.length && !d.blocks.length && <p>Free day</p>}
                    </div>
                  </Row>
                </Link>
              ))}
            </List>
          </Section>
        </div>
      </div>
    </>
  );
}

