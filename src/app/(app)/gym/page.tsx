import { eq } from "drizzle-orm";
import { Dumbbell, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { DeleteFooter, Submit } from "@/components/submit";
import {
  buttonClass,
  Card,
  Empty,
  Field,
  PageHeader,
  Section,
} from "@/components/ui";
import { addGymDay, deleteGymDay, saveGymDay } from "@/app/actions/school";
import { getDb, schema } from "@/lib/db";
import { formatExercises } from "@/lib/gym";
import { requireModule } from "@/lib/sections";
import { WEEKDAYS } from "@/lib/time";

export const metadata = { title: "Gym" };

export default async function GymPage() {
  const user = await requireModule("gym");
  const db = await getDb();
  const gym = await db
    .select()
    .from(schema.gymDays)
    .where(eq(schema.gymDays.userId, user.id));
  const freeGymDays = [1, 2, 3, 4, 5, 6, 7].filter(
    (d) => !gym.some((g) => g.weekday === d),
  );
  // "Right after school" only makes sense with a timetable.
  const school = user.modules.includes("school");

  return (
    <>
      <PageHeader
        title="Gym"
        subtitle={`${gym.length} training day${gym.length === 1 ? "" : "s"} a week`}
      />
      <div>
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
                <GymForm
                  action={addGymDay}
                  days={freeGymDays}
                  school={school}
                />
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
                          {g.timing === "after_school"
                            ? "after school"
                            : g.timing === "fixed"
                              ? `at ${g.startTime}`
                              : "flexible"}
                        </p>
                        <p className="text-[17px] font-semibold">{g.title}</p>
                      </div>
                      <Sheet
                        title={`${WEEKDAYS[g.weekday - 1]} workout`}
                        trigger={<Pencil size={15} />}
                        triggerLabel={`Edit ${WEEKDAYS[g.weekday - 1]} workout`}
                        triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill"
                      >
                        <GymForm
                          action={saveGymDay.bind(null, g.weekday)}
                          gym={g}
                          school={school}
                        />
                        <DeleteFooter
                          action={deleteGymDay.bind(null, g.weekday)}
                          message={`Remove ${WEEKDAYS[g.weekday - 1]} from your gym days?`}
                        >
                          <Trash2 size={15} /> Remove gym day
                        </DeleteFooter>
                      </Sheet>
                    </div>
                    <ul className="px-4 pt-1 pb-3 text-[14px]">
                      {g.exercises.map((e, i) => (
                        <li
                          key={i}
                          className="flex justify-between gap-2 py-0.5"
                        >
                          <span>{e.name}</span>
                          <span className="shrink-0 text-label-2 tabular-nums">
                            {e.sets} sets
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
            </div>
          )}
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
      <Field label="Exercises (one per line, “Name × sets”)">
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
