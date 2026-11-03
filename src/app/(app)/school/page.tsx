import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { DeleteFooter, Submit } from "@/components/submit";
import { buttonClass, Card, Empty, Field, List, PageHeader, Row, Section } from "@/components/ui";
import { addTutoring, deleteTutoring, saveSchoolDay, updateTutoring } from "@/app/actions/school";
import { requireModule } from "@/lib/sections";
import { syncIfStale } from "@/lib/calendar-sync";
import { getDb, schema } from "@/lib/db";
import { getPlanAdvice, getSettings } from "@/lib/settings";
import { fmtDate, schoolPeriods, toHHMM, weekdayOf, WEEKDAYS } from "@/lib/time";
import { getSchool, todayIn } from "@/lib/week";

export const metadata = { title: "School" };

export default async function SchoolPage() {
  const user = await requireModule("school");
  await syncIfStale(user.id); // in the background, after the page is sent
  const db = await getDb();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const [{ days: schoolDays, classes }, advice, tutoring] = await Promise.all([
    getSchool(user.id),
    getPlanAdvice(user.id),
    db.select().from(schema.tutoring).where(eq(schema.tutoring.userId, user.id)).orderBy(asc(schema.tutoring.weekday), asc(schema.tutoring.start)),
  ]);
  const targets = advice?.dailyTargets ?? [];

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
            <TutoringForm action={addTutoring} today={today} />
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
                <Sheet title={`${t.subject} tutoring`} trigger={<Pencil size={15} />} triggerLabel={`Edit ${t.subject} tutoring`} triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill">
                  <TutoringForm action={updateTutoring.bind(null, t.id)} today={today} session={t} />
                  <DeleteFooter action={deleteTutoring.bind(null, t.id)} message={`Remove ${t.subject} tutoring?`}>
                    <Trash2 size={15} /> Remove tutoring
                  </DeleteFooter>
                </Sheet>
              </Row>
            ))}
          </List>
        )}
      </Section>

      <div className="grid gap-x-8 xl:grid-cols-[1fr_360px]">
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

const shortDate = (d: string) => fmtDate(d, { day: "numeric", month: "short" });

function TutoringForm({
  action,
  session,
  today,
}: {
  action: (fd: FormData) => Promise<void>;
  session?: { subject: string; weekday: number; start: string; end: string; everyWeeks: number; startDate: string; place: string };
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
      <Submit className="self-end">Save</Submit>
    </form>
  );
}
