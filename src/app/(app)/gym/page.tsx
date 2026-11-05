import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { Dumbbell, LineChart as LineIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { LineChart } from "@/components/charts";
import { GymCoach } from "@/components/gym-coach";
import { Sheet } from "@/components/sheet";
import { DeleteFooter, Submit } from "@/components/submit";
import { buttonClass, Card, Empty, Field, PageHeader, Section } from "@/components/ui";
import { WorkoutLog, type LogExercise } from "@/components/workout-log";
import { addGymDay, deleteGymDay, saveGymDay } from "@/app/actions/school";
import { claudeAvailable } from "@/lib/ai/claude";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_REPS, fmtSet, formatExercises, nextTarget, progressSeries, type SetLog } from "@/lib/gym";
import { requireModule } from "@/lib/sections";
import { getSettings } from "@/lib/settings";
import { addDays, fmtDate, WEEKDAYS, weekdayOf } from "@/lib/time";
import { todayIn } from "@/lib/week";
import type { ChatMessage } from "@/components/claude-panel";

export const metadata = { title: "Gym" };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default async function GymPage({ searchParams }: { searchParams: Promise<{ day?: string; ex?: string }> }) {
  const user = await requireModule("gym");
  const { day: dayParam, ex: exParam } = await searchParams;
  const db = await getDb();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const [gym, logs, chat, claudeConfigured] = await Promise.all([
    db.select().from(schema.gymDays).where(eq(schema.gymDays.userId, user.id)),
    db
      .select({ date: schema.gymSets.date, exercise: schema.gymSets.exercise, setNo: schema.gymSets.setNo, weight: schema.gymSets.weight, reps: schema.gymSets.reps })
      .from(schema.gymSets)
      .where(and(eq(schema.gymSets.userId, user.id), gte(schema.gymSets.date, addDays(today, -366))))
      .orderBy(asc(schema.gymSets.date)),
    db
      .select()
      .from(schema.aiMessages)
      .where(and(eq(schema.aiMessages.userId, user.id), eq(schema.aiMessages.targetType, "gym"), eq(schema.aiMessages.targetId, 0)))
      .orderBy(asc(schema.aiMessages.id)),
    claudeAvailable(user.id),
  ]);
  gym.sort((a, b) => a.weekday - b.weekday);
  const freeGymDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => !gym.some((g) => g.weekday === d));
  // "Right after school" only makes sense with a timetable.
  const school = user.modules.includes("school");

  // Today's workout: today's gym day, or the one picked with ?day=.
  const todayWeekday = weekdayOf(today);
  const picked = Number(dayParam);
  const logDay = gym.find((g) => g.weekday === picked) ?? gym.find((g) => g.weekday === todayWeekday) ?? null;
  const history = (name: string): SetLog[] => logs.filter((l) => same(l.exercise, name) && l.date < today);
  const logExercises: LogExercise[] = (logDay?.exercises ?? []).map((e) => ({
    name: e.name,
    sets: e.sets,
    reps: e.reps ?? DEFAULT_REPS,
    target: nextTarget(e, history(e.name)),
    today: logs.filter((l) => same(l.exercise, e.name) && l.date === today).map(({ setNo, weight, reps }) => ({ setNo, weight, reps })),
  }));

  // Progress: one exercise at a time, most recently logged first.
  const logged = [...new Set([...logs].reverse().map((l) => l.exercise))];
  const exercise = logged.find((n) => exParam && same(n, exParam)) ?? logged[0] ?? null;
  const series = exercise ? progressSeries(logs.filter((l) => same(l.exercise, exercise))).slice(-16) : [];
  const bodyweight = series.length > 0 && series.every((p) => p.top === 0);
  const best = series.reduce<(typeof series)[number] | null>((b, p) => (!b || p.top > b.top || (p.top === b.top && p.reps > b.reps) ? p : b), null);
  const href = (q: { day?: number; ex?: string }) => {
    const params = new URLSearchParams();
    const d = q.day ?? (logDay && logDay.weekday !== todayWeekday ? logDay.weekday : undefined);
    if (d) params.set("day", String(d));
    const e = q.ex ?? (exParam || undefined);
    if (e) params.set("ex", e);
    const s = params.toString();
    return `/gym${s ? `?${s}` : ""}`;
  };

  const messages = chat.map<ChatMessage>((m) => ({ id: m.id, role: m.role as ChatMessage["role"], content: m.content, proposal: m.proposal, applied: m.applied }));

  return (
    <>
      <PageHeader title="Gym" subtitle={`${gym.length} training day${gym.length === 1 ? "" : "s"} a week`} />
      <div className="flex flex-col gap-2">
        {gym.length > 0 && (
          <Section
            title={logDay ? `${logDay.weekday === todayWeekday ? "Today" : WEEKDAYS[logDay.weekday - 1]} · ${logDay.title}` : "Log a workout"}
            footer="Tick each set when it's done. When every set reaches the target reps, next time suggests +2.5 kg; otherwise +1 rep."
            action={
              <div className="flex flex-wrap justify-end gap-1">
                {gym.map((g) => (
                  <Link
                    key={g.weekday}
                    href={href({ day: g.weekday })}
                    scroll={false}
                    aria-current={logDay?.weekday === g.weekday ? "true" : undefined}
                    className={buttonClass(logDay?.weekday === g.weekday ? "tinted" : "plain", "sm")}
                  >
                    {WEEKDAYS[g.weekday - 1].slice(0, 3)}
                  </Link>
                ))}
              </div>
            }
          >
            {logDay ? (
              logExercises.length ? (
                <WorkoutLog key={`${today}-${logDay.weekday}`} exercises={logExercises} />
              ) : (
                <Card className="p-4 text-[14px] text-label-2">Add exercises to {WEEKDAYS[logDay.weekday - 1]} below to log them.</Card>
              )
            ) : (
              <Card className="p-4 text-[14px] text-label-2">No workout planned today. Pick a day above to log it anyway.</Card>
            )}
          </Section>
        )}

        {exercise && (
          <Section
            title="Progress"
            footer={bodyweight ? "Reps in the best set of each session." : "Heaviest set of each session, in kg."}
            action={
              logged.length > 1 && (
                <div className="flex max-w-[60vw] flex-wrap justify-end gap-1">
                  {logged.slice(0, 12).map((n) => (
                    <Link key={n} href={href({ ex: n })} scroll={false} className={buttonClass(same(n, exercise) ? "tinted" : "plain", "sm")}>
                      {n}
                    </Link>
                  ))}
                </div>
              )
            }
          >
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <LineIcon size={16} className="text-orange" />
                <p className="mr-auto text-[17px] font-semibold">{exercise}</p>
                {best && <span className="chip" data-tone="orange">Best {fmtSet({ weight: best.top, reps: best.reps })}</span>}
                <span className="chip">{series.length} session{series.length === 1 ? "" : "s"}</span>
              </div>
              {series.length > 1 ? (
                <LineChart
                  labels={series.map((p) => fmtDate(p.date, { day: "numeric", month: "short" }))}
                  series={[{ label: bodyweight ? "Reps" : "Top set (kg)", values: series.map((p) => (bodyweight ? p.reps : p.top)), color: "var(--orange)" }]}
                  format={(v) => (bodyweight ? String(Math.round(v)) : `${Math.round(v * 10) / 10}`)}
                />
              ) : (
                <p className="text-[14px] text-label-2">Log one more session to see the line.</p>
              )}
              <ul className="mt-3 divide-y divide-separator text-[14px]">
                {[...new Set(logs.filter((l) => same(l.exercise, exercise)).map((l) => l.date))]
                  .reverse()
                  .slice(0, 5)
                  .map((date) => (
                    <li key={date} className="flex justify-between gap-3 py-1.5">
                      <span className="text-label-2">{date === today ? "Today" : fmtDate(date, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="text-right tabular-nums">
                        {logs
                          .filter((l) => same(l.exercise, exercise) && l.date === date)
                          .sort((a, b) => a.setNo - b.setNo)
                          .map(fmtSet)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          </Section>
        )}

        <Section
          title="Gym split"
          footer="Change exercises whenever your split changes. The planner uses each day's duration."
          action={
            freeGymDays.length > 0 && (
              <Sheet
                title="Add gym day"
                trigger={
                  <>
                    <Plus size={14} /> Add day
                  </>
                }
                triggerClassName={buttonClass("plain", "sm")}
              >
                <GymForm action={addGymDay} days={freeGymDays} school={school} />
              </Sheet>
            )
          }
        >
          {gym.length === 0 ? (
            <Empty icon={<Dumbbell size={34} />} title="No gym days">
              Add a day, or ask the coach below to build a split for you.
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {gym.map((g) => (
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
                      <GymForm action={saveGymDay.bind(null, g.weekday)} gym={g} school={school} />
                      <DeleteFooter action={deleteGymDay.bind(null, g.weekday)} message={`Remove ${WEEKDAYS[g.weekday - 1]} from your gym days?`}>
                        <Trash2 size={15} /> Remove gym day
                      </DeleteFooter>
                    </Sheet>
                  </div>
                  <ul className="px-4 pt-1 pb-3 text-[14px]">
                    {g.exercises.map((e, i) => (
                      <li key={i} className="flex justify-between gap-2 py-0.5">
                        <span>{e.name}</span>
                        <span className="shrink-0 text-label-2 tabular-nums">
                          {e.sets} × {e.reps ?? DEFAULT_REPS}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section title="Coach" footer="Sonnet 5.5 sees your split, your week's busy times and your last 4 weeks of logged sets. Not medical advice.">
          <GymCoach
            split={gym.map(({ weekday, title, durationMin, timing, startTime, exercises }) => ({ weekday, title, durationMin, timing, startTime, exercises }))}
            initialMessages={messages}
            claudeConfigured={claudeConfigured}
          />
        </Section>
      </div>
    </>
  );
}

function GymForm({
  action,
  gym,
  days,
  school,
}: {
  action: (fd: FormData) => Promise<void>;
  school: boolean;
  gym?: {
    title: string;
    durationMin: number;
    exercises: { name: string; sets: number }[];
    timing: string;
    startTime: string | null;
  };
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
          <input
            name="title"
            required
            defaultValue={gym?.title}
            className="field"
            placeholder="e.g. Push"
          />
        </Field>
        <Field label="Minutes">
          <input
            name="durationMin"
            type="number"
            min={15}
            max={240}
            step={5}
            required
            defaultValue={gym?.durationMin ?? 75}
            className="field"
          />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field
          label="When"
          hint="Flexible = the planner suggests a time each week."
        >
          <select
            name="timing"
            defaultValue={gym?.timing ?? "flexible"}
            className="field"
          >
            <option value="flexible">Flexible</option>
            {(school || gym?.timing === "after_school") && (
              <option value="after_school">Right after school</option>
            )}
            <option value="fixed">At a set time</option>
          </select>
        </Field>
        <Field label="Set time">
          <input
            type="time"
            name="startTime"
            defaultValue={gym?.startTime ?? ""}
            className="field"
          />
        </Field>
      </div>
      <Field label="Exercises (one per line, “Name × sets × reps”)" hint="Reps is the target; once every set reaches it, the log suggests +2.5 kg. Without it the target is 10.">
        <textarea
          name="exercises"
          rows={9}
          defaultValue={gym ? formatExercises(gym.exercises) : ""}
          className="field font-mono text-[13px]"
        />
      </Field>
      <Submit className="self-end">Save</Submit>
    </form>
  );
}
