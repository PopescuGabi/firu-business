"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Check, TrendingUp } from "lucide-react";
import { logSet, unlogSet } from "@/app/actions/gym";
import type { Target } from "@/lib/gym";
import { fmtDate } from "@/lib/time";

export type LogExercise = {
  name: string;
  sets: number;
  reps: number; // target
  target: Target;
  today: { setNo: number; weight: number; reps: number }[];
};

/** Today's workout: every set prefilled with the progression target; tick it when it's done. */
export function WorkoutLog({ exercises }: { exercises: LogExercise[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {exercises.map((e) => (
        <ExerciseCard key={e.name} ex={e} />
      ))}
    </div>
  );
}

function TargetChip({ target }: { target: Target }) {
  if (target.change === "kg")
    return (
      <span className="chip" data-tone="orange" title="Every set reached the target reps last time">
        <TrendingUp size={13} /> +2.5 kg
      </span>
    );
  if (target.change === "rep")
    return (
      <span className="chip" data-tone="blue" title="Same weight, aim for one more rep">
        +1 rep
      </span>
    );
  return <span className="chip">First log</span>;
}

function ExerciseCard({ ex }: { ex: LogExercise }) {
  const done = ex.today.length;
  const last = ex.target.last;
  return (
    <div className="glass rounded-[24px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{ex.name}</p>
          <p className="text-[12px] text-label-2">
            {ex.sets} × {ex.reps} reps
            {last && (
              <>
                {" · last "}
                {fmtDate(last.date, { day: "numeric", month: "short" })}:{" "}
                {last.sets[0]?.weight ? `${Math.max(...last.sets.map((s) => s.weight))} kg × ` : ""}
                {last.sets.map((s) => s.reps).join(", ")}
              </>
            )}
          </p>
        </div>
        <TargetChip target={ex.target} />
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {Array.from({ length: Math.max(ex.sets, done) }, (_, i) => i + 1).map((no) => (
          <SetRow key={no} exercise={ex.name} setNo={no} target={ex.target} logged={ex.today.find((t) => t.setNo === no)} />
        ))}
      </ul>
      <p className="mt-2 text-right text-[12px] text-label-3 tabular-nums">
        {done}/{ex.sets} sets
      </p>
    </div>
  );
}

function SetRow({ exercise, setNo, target, logged }: { exercise: string; setNo: number; target: Target; logged?: { weight: number; reps: number } }) {
  const [weight, setWeight] = useState(String(logged?.weight ?? (target.weight || "")));
  const [reps, setReps] = useState(String(logged?.reps ?? target.reps));
  const [done, setDone] = useState(Boolean(logged));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    setError(null);
    const kg = Number(weight.replace(",", ".") || 0);
    const r = Number(reps);
    if (!done && (!Number.isFinite(kg) || kg < 0 || !Number.isInteger(r) || r < 1)) return setError("Check the numbers");
    const next = !done;
    setDone(next);
    start(async () => {
      try {
        if (next) await logSet({ exercise, setNo, weight: kg, reps: r });
        else await unlogSet(exercise, setNo);
      } catch {
        setDone(!next);
        setError("Couldn't save");
      }
    });
  }

  return (
    <li className={clsx("flex items-center gap-2 rounded-[16px] px-3 py-1.5 transition", done ? "bg-accent-soft" : "bg-well")}>
      <span className="w-12 text-[13px] font-semibold text-label-2">Set {setNo}</span>
      <label className="flex flex-1 items-center gap-1">
        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          disabled={done}
          placeholder="0"
          aria-label={`${exercise} set ${setNo} weight in kg`}
          className="w-full min-w-0 rounded-lg bg-transparent px-1 py-1 text-right text-[15px] font-semibold tabular-nums outline-none focus:bg-fill"
        />
        <span className="text-[12px] text-label-3">kg</span>
      </label>
      <span className="text-label-3">×</span>
      <label className="flex w-20 items-center gap-1">
        <input
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          disabled={done}
          aria-label={`${exercise} set ${setNo} reps`}
          className="w-full min-w-0 rounded-lg bg-transparent px-1 py-1 text-right text-[15px] font-semibold tabular-nums outline-none focus:bg-fill"
        />
        <span className="text-[12px] text-label-3">reps</span>
      </label>
      <button
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Untick set ${setNo}` : `Set ${setNo} done`}
        disabled={pending}
        onClick={toggle}
        className={clsx(
          "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition",
          done ? "border-accent bg-accent text-white" : "border-label-3 text-transparent hover:border-accent",
        )}
      >
        <Check size={15} strokeWidth={3.5} />
      </button>
      {error && <span role="alert" className="text-[11px] text-red">{error}</span>}
    </li>
  );
}
