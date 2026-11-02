import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { BookOpen, CalendarCheck, Dumbbell, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { ConfirmButton, Submit } from "@/components/submit";
import { buttonClass, Card, Empty, Field, List, Notice, PageHeader, Row, Section } from "@/components/ui";
import { addGymDay, addTutoring, deleteGymDay, deleteTutoring, saveGymDay, saveSchoolDay, updateTutoring } from "@/app/actions/school";
import { getDb, schema } from "@/lib/db";
import { formatExercises } from "@/lib/gym";
import { getSettings } from "@/lib/settings";
import { schoolPeriods, toHHMM, weekdayOf, WEEKDAYS } from "@/lib/time";
import { getGoogleAccount } from "@/lib/google/oauth";
import { getSchool, todayIn } from "@/lib/week";

export const metadata = { title: "School" };

type PlanAdvice = { dailyTargets: { date: string; studyMin: number; projectMin: number; gymMin: number; note: string }[] };

export default async function SchoolPage() {
  const db = await getDb();
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const [{ days: schoolDays, classes }, gym, adviceRow, tutoring, account] = await Promise.all([
    getSchool(),
    db.select().from(schema.gymDays),
    db.select().from(schema.settings).where(eq(schema.settings.key, "planAdvice")),
    db.select().from(schema.tutoring).orderBy(asc(schema.tutoring.weekday), asc(schema.tutoring.start)),
    getGoogleAccount(),
  ]);
  const googleConnected = Boolean(account?.accessToken);
  const targets = (adviceRow[0]?.value as PlanAdvice | undefined)?.dailyTargets ?? [];
  const freeGymDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => !gym.some((g) => g.weekday === d));

  return (
    <>
      <PageHeader title="School" subtitle={`${settings.classMinutes} min classes · ${settings.breakMinutes} min breaks`} />

      <Section title="Timetable" footer="Tap a day to change its start time or classes.">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {[1, 2, 3, 4, 5].map((wd) => {
            const day = schoolDays.find((d) => d.weekday === wd);
            const subjects = classes.filter((c) => c.weekday === wd);
            const periods = day ? schoolPeriods(day.startTime, subjects.length, settings.classMinutes, settings.breakMinutes) : [];
            return (
              <Card key={wd} className="flex flex-col">
                <div className="flex items-center justify-between border-b border-separator px-4 py-2.5">
                  <div>
                    <p className="font-semibold">{WEEKDAYS[wd - 1]}</p>
                    <p className="text-[12px] text-label-2">
                      {periods.length ? `${toHHMM(periods[0].start)}–${toHHMM(periods.at(-1)!.end)}` : "No school"}
                    </p>
                  </div>
                  <Sheet
                    title={`${WEEKDAYS[wd - 1]} classes`}
                    trigger={<Pencil size={15} />}
                    triggerLabel={`Edit ${WEEKDAYS[wd - 1]}`}
                    triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill"
                  >
                    <form action={saveSchoolDay.bind(null, wd)} className="flex flex-col gap-4">
                      <Field label="First class starts at">
                        <input type="time" name="startTime" required defaultValue={day?.startTime ?? "08:00"} className="field" />
                      </Field>
                      <Field label="Classes, in order (one per line)" hint="Leave empty if there's no school this day.">
                        <textarea name="subjects" rows={8} defaultValue={subjects.map((s) => s.subject).join("\n")} className="field" />
                      </Field>
                      <Submit className="self-end">Save</Submit>
                    </form>
                  </Sheet>
                </div>
                <ol className="flex-1 divide-y divide-separator">
                  {subjects.map((s, i) => (
                    <li key={i} className="flex items-baseline gap-3 px-4 py-2 text-[14px]">
                      <span className="w-10 shrink-0 text-[12px] text-label-2 tabular-nums">{toHHMM(periods[i].start)}</span>
                      <span className="truncate">{s.subject}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section
        title="Tutoring"
        footer="Fixed sessions. The planner keeps them free and only plans study time for these subjects."
        action={
          <Sheet title="Add tutoring" trigger={<><Plus size={14} /> Add</>} triggerClassName={buttonClass("plain", "sm")}>
            <TutoringForm action={addTutoring} googleConnected={googleConnected} today={today} />
          </Sheet>
        }
      >
        {tutoring.length === 0 ? (
          <Empty icon={<BookOpen size={34} />} title="No tutoring yet">Add each subject you have tutoring for.</Empty>
        ) : (
          <List>
            {tutoring.map((t) => (
              <Row key={t.id}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-pink/15 text-pink">
                  <BookOpen size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-[13px] text-label-2">
                    {t.everyWeeks === 1 ? `Every ${WEEKDAYS[t.weekday - 1]}` : `Every ${t.everyWeeks} weeks on ${WEEKDAYS[t.weekday - 1]}`} · {t.start}–{t.end}
                    {t.everyWeeks > 1 && ` · from ${shortDate(t.startDate)}`} · {t.place === "online" ? "online" : t.place}
                  </p>
                </div>
                {t.gcalEventId && (
                  <span className="hidden items-center gap-1 text-[12px] text-label-2 sm:flex">
                    <CalendarCheck size={13} /> In Google Calendar
                  </span>
                )}
                <Sheet title={`${t.subject} tutoring`} trigger={<Pencil size={15} />} triggerLabel={`Edit ${t.subject} tutoring`} triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill">
                  <TutoringForm action={updateTutoring.bind(null, t.id)} googleConnected={googleConnected} today={today} session={t} />
                  <form action={deleteTutoring.bind(null, t.id)} className="mt-3 border-t border-separator pt-3">
                    <ConfirmButton message={`Remove ${t.subject} tutoring${t.gcalEventId ? " (also from Google Calendar)" : ""}?`}>
                      <Trash2 size={15} /> Remove tutoring
                    </ConfirmButton>
                  </form>
                </Sheet>
              </Row>
            ))}
          </List>
        )}
      </Section>

      <div className="grid gap-x-8 xl:grid-cols-[1fr_360px]">
        <Section
          title="Gym split"
          footer="Change exercises whenever your split changes. The planner uses each day's duration."
          action={
            freeGymDays.length > 0 && (
              <Sheet title="Add gym day" trigger={<><Plus size={14} /> Add day</>} triggerClassName={buttonClass("plain", "sm")}>
                <GymForm action={addGymDay} days={freeGymDays} />
              </Sheet>
            )
          }
        >
          {gym.length === 0 ? (
            <Empty icon={<Dumbbell size={34} />} title="No gym days" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {gym
                .sort((a, b) => a.weekday - b.weekday)
                .map((g) => (
                  <Card key={g.weekday}>
                    <div className="flex items-start justify-between gap-2 px-4 pt-3">
                      <div>
                        <p className="text-[12px] font-semibold text-orange uppercase">
                          {WEEKDAYS[g.weekday - 1]} · {g.durationMin} min ·{" "}
                          {g.timing === "after_school" ? "after school" : g.timing === "fixed" ? `at ${g.startTime}` : "flexible"}
                        </p>
                        <p className="text-[17px] font-semibold">{g.title}</p>
                      </div>
                      <Sheet
                        title={`${WEEKDAYS[g.weekday - 1]} workout`}
                        trigger={<Pencil size={15} />}
                        triggerLabel={`Edit ${WEEKDAYS[g.weekday - 1]} workout`}
                        triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill"
                      >
                        <GymForm action={saveGymDay.bind(null, g.weekday)} gym={g} />
                        <form action={deleteGymDay.bind(null, g.weekday)} className="mt-3 border-t border-separator pt-3">
                          <ConfirmButton message={`Remove ${WEEKDAYS[g.weekday - 1]} from your gym days?`}>
                            <Trash2 size={15} /> Remove gym day
                          </ConfirmButton>
                        </form>
                      </Sheet>
                    </div>
                    <ul className="px-4 pt-1 pb-3 text-[14px]">
                      {g.exercises.map((e, i) => (
                        <li key={i} className="flex justify-between gap-2 py-0.5">
                          <span>{e.name}</span>
                          <span className="shrink-0 text-label-2 tabular-nums">{e.sets} sets</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
            </div>
          )}
        </Section>

        <div>
          <Section title="Recommended daily time" footer="From your last “Plan my week”. Study, project work and gym.">
            {targets.length ? (
              <List>
                {targets.map((t) => (
                  <Row key={t.date} className="text-[14px]">
                    <span className="w-10 font-semibold">{WEEKDAYS[weekdayOf(t.date) - 1].slice(0, 3)}</span>
                    <span className="flex-1 text-purple">{t.studyMin}m study</span>
                    <span className="flex-1 text-blue">{t.projectMin}m projects</span>
                    <span className="w-16 text-right text-orange">{t.gymMin ? `${t.gymMin}m gym` : "rest"}</span>
                  </Row>
                ))}
              </List>
            ) : (
              <Card className="p-4 text-[14px] text-label-2">
                Go to <Link href="/today" className="font-semibold text-blue">Today</Link> and tap &ldquo;Plan my week&rdquo;.
              </Card>
            )}
          </Section>

        </div>
      </div>
    </>
  );
}

function GymForm({
  action,
  gym,
  days,
}: {
  action: (fd: FormData) => Promise<void>;
  gym?: { title: string; durationMin: number; exercises: { name: string; sets: number }[]; timing: string; startTime: string | null };
  days?: number[];
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {days && (
        <Field label="Day">
          <select name="weekday" className="field" required>
            {days.map((d) => (
              <option key={d} value={d}>
                {WEEKDAYS[d - 1]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Workout">
          <input name="title" required defaultValue={gym?.title} className="field" placeholder="e.g. Push" />
        </Field>
        <Field label="Minutes">
          <input name="durationMin" type="number" min={15} max={240} step={5} required defaultValue={gym?.durationMin ?? 75} className="field" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="When" hint="Flexible = the planner suggests a time each week.">
          <select name="timing" defaultValue={gym?.timing ?? "flexible"} className="field">
            <option value="flexible">Flexible</option>
            <option value="after_school">Right after school</option>
            <option value="fixed">At a set time</option>
          </select>
        </Field>
        <Field label="Set time">
          <input type="time" name="startTime" defaultValue={gym?.startTime ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Exercises (one per line, “Name × sets”)">
        <textarea name="exercises" rows={9} defaultValue={gym ? formatExercises(gym.exercises) : ""} className="field font-mono text-[13px]" />
      </Field>
      <Submit className="self-end">Save</Submit>
    </form>
  );
}

const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function TutoringForm({
  action,
  session,
  googleConnected,
  today,
}: {
  action: (fd: FormData) => Promise<void>;
  session?: { subject: string; weekday: number; start: string; end: string; everyWeeks: number; startDate: string; gcalEventId: string | null; place: string };
  googleConnected: boolean;
  today: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Subject">
        <input name="subject" required maxLength={100} defaultValue={session?.subject} className="field" placeholder="e.g. Physics" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Day">
          <select name="weekday" defaultValue={session?.weekday ?? 1} className="field">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="time" name="start" required defaultValue={session?.start ?? "16:00"} className="field" />
        </Field>
        <Field label="To">
          <input type="time" name="end" required defaultValue={session?.end ?? "18:00"} className="field" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Repeats">
          <select name="everyWeeks" defaultValue={session?.everyWeeks ?? 1} className="field">
            <option value={1}>Every week</option>
            <option value={2}>Every other week</option>
            <option value={3}>Every 3 weeks</option>
            <option value={4}>Every 4 weeks</option>
          </select>
        </Field>
        <Field label="First session" hint="Moved to the chosen day if needed.">
          <input type="date" name="startDate" defaultValue={session?.startDate ?? today} className="field" />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label="Where" hint="Used for travel times (Settings → Travel times).">
          <input name="place" maxLength={60} defaultValue={session && session.place !== "online" ? session.place : ""} placeholder={`e.g. ${session?.subject ?? "Math"} tutoring`} className="field" />
        </Field>
        <label className="flex h-10 items-center gap-2 text-[15px]">
          <input type="checkbox" name="online" defaultChecked={session?.place === "online"} className="size-4 accent-[var(--blue)]" />
          Online
        </label>
      </div>
      {googleConnected && (
        <label className="flex items-center gap-2.5 text-[15px]">
          <input type="checkbox" name="google" defaultChecked={session ? Boolean(session.gcalEventId) : true} className="size-4 accent-[var(--blue)]" />
          Also add to Google Calendar (repeating)
        </label>
      )}
      <Submit className="self-end">Save</Submit>
    </form>
  );
}
