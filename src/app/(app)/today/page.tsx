import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { Dumbbell, ListTodo, Pencil, Settings, Trash2 } from "lucide-react";
import { fmtMin, Stat, Timeline, type PlanAdvice } from "@/components/day-timeline";
import { ClearSuggestions } from "@/components/clear-suggestions";
import { ClashNotice } from "@/components/clash-notice";
import { PlanButton } from "@/components/plan-button";
import { Sheet } from "@/components/sheet";
import { ConfirmButton } from "@/components/submit";
import { TaskCheck } from "@/components/task-check";
import { TaskForm } from "@/components/task-form";
import { buttonClass, Card, Empty, List, Notice, PageHeader, Pill, Row, Section } from "@/components/ui";
import { createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { toHHMM, toMin, WEEKDAYS } from "@/lib/time";
import { countSuggestions, getWeek, nowMinutesIn, todayIn, type DayView } from "@/lib/week";
import { getSettings } from "@/lib/settings";
import { KIND_COLORS } from "@/lib/kinds";



function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}


export const metadata = { title: "Today" };

export default async function TodayPage() {
  const db = await getDb();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const now = nowMinutesIn(settings.timezone);
  const [{ days, calendarError, googleConnected }, tasks, clients, adviceRow] = await Promise.all([
    getWeek(today, 7),
    db.select().from(schema.tasks).orderBy(asc(schema.tasks.done), asc(schema.tasks.due), desc(schema.tasks.priority)),
    db.select().from(schema.clients).where(eq(schema.clients.archived, false)).orderBy(asc(schema.clients.name)),
    db.select().from(schema.settings).where(eq(schema.settings.key, "planAdvice")),
  ]);
  const day = days[0];
  const advice = adviceRow[0]?.value as PlanAdvice | undefined;
  const target = advice?.dailyTargets.find((t) => t.date === today);
  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done).slice(0, 5);
  const clientName = (id: number | null) => clients.find((c) => c.id === id);
  const hasPending = days.some((d) => d.blocks.some((b) => b.status === "proposed"));

  return (
    <>
      <PageHeader
        subtitle={longDate(today)}
        title="Today"
        actions={
          <>
            <ClearSuggestions count={await countSuggestions()} />
            <PlanButton claudeConfigured={env.claudeConfigured()} />
            <Link href="/settings" aria-label="Settings" className="grid size-9 place-items-center rounded-full bg-fill text-label-2 md:hidden">
              <Settings size={18} />
            </Link>
          </>
        }
      />

      {!googleConnected && (
        <Notice tone="orange">
          Google Calendar isn&apos;t connected yet, so tutoring and other events aren&apos;t shown.{" "}
          <Link href="/settings" className="font-semibold text-blue">Connect in Settings</Link>
        </Notice>
      )}
      {calendarError && <Notice tone="red">Couldn&apos;t load Google Calendar: {calendarError}</Notice>}
      <ClashNotice days={days} />

      <div className="grid gap-x-8 lg:grid-cols-[1fr_340px]">
        <div>
          <Section title="Schedule" footer={hasPending ? "Tap ✓ to accept a suggestion. Accepted blocks go to your Personal Hub calendar when sync is on." : undefined}>
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
                Add tasks for clients or school. &ldquo;Plan my week&rdquo; fits them into your free time.
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
                        <form action={deleteTask.bind(null, t.id)} className="mt-3 border-t border-separator pt-3">
                          <ConfirmButton message="Delete this task?">
                            <Trash2 size={15} /> Delete task
                          </ConfirmButton>
                        </form>
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
          <Section title="Recommended today">
            <Card className="p-4">
              {target ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Study" value={fmtMin(target.studyMin)} color="var(--purple)" />
                    <Stat label="Projects" value={fmtMin(target.projectMin)} color="var(--blue)" />
                    <Stat label="Gym" value={target.gymMin ? fmtMin(target.gymMin) : "Rest"} color="var(--orange)" />
                  </div>
                  {target.note && <p className="mt-3 text-[14px] text-label-2">{target.note}</p>}
                </>
              ) : (
                <p className="text-[14px] text-label-2">
                  Run &ldquo;Plan my week&rdquo; to get recommended study, project and gym time for each day.
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
                      {d.school.length > 0 && <p className="truncate">School {toHHMM(d.school[0].start)}–{toHHMM(d.school.at(-1)!.end)}</p>}
                      {d.tutoring.map((t) => (
                        <p key={t.id} className="truncate text-pink">
                          {t.start} {t.subject} tutoring
                        </p>
                      ))}
                      {d.gym && (
                        <p className="flex items-center gap-1 truncate text-orange">
                          <Dumbbell size={12} /> {d.gym.title}
                        </p>
                      )}
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
                      {!d.school.length && !d.gym && !d.events.length && !d.blocks.length && !d.tutoring.length && <p>Free day</p>}
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

