"use client";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { diffSplit, gymProposal, type GymDayNow } from "@/lib/gym";
import { WEEKDAYS } from "@/lib/time";
import { ClaudePanel, type ChatMessage } from "./claude-panel";

const SUGGESTIONS = [
  "Build me a 4-day split for strength",
  "Make my longest day fit in 60 minutes",
  "Swap in exercises I can do at home",
  "How should I progress over the next 4 weeks?",
];

const TONE = { new: "text-green", changed: "text-orange", removed: "text-red", same: "text-label-3" } as const;
const LABEL = { new: "New day", changed: "Changed", removed: "Removed", same: "No change" } as const;

/** Gym → Coach: Sonnet suggests split changes from your week and logs; one tap applies them. */
export function GymCoach({ split, initialMessages, claudeConfigured }: { split: GymDayNow[]; initialMessages: ChatMessage[]; claudeConfigured: boolean }) {
  const router = useRouter();
  return (
    <div className="h-[560px]">
      <ClaudePanel<null>
        targetType="gym"
        targetId={0}
        endpoint="/api/ai/gym"
        modelLabel="Sonnet 5.5 · coach"
        emptyTitle="Ask your coach"
        initialMessages={initialMessages}
        prompts={[]}
        claudeConfigured={claudeConfigured}
        suggestions={SUGGESTIONS}
        onApplied={() => router.refresh()}
        renderProposal={(raw) => {
          const parsed = gymProposal.safeParse(raw);
          if (!parsed.success) return <p className="text-label-2">This proposal can&apos;t be shown.</p>;
          const p = parsed.data;
          return (
            <>
              <p>{p.summary}</p>
              {diffSplit(split, p).map((c) => (
                <div key={c.weekday} className="rounded-[14px] bg-well px-3 py-2">
                  <p className="text-[12px] font-semibold uppercase">
                    {WEEKDAYS[c.weekday - 1]} · <span className={clsx(TONE[c.kind])}>{LABEL[c.kind]}</span>
                  </p>
                  {c.kind === "removed" ? (
                    <p className="text-label-2 line-through">{c.before.title}</p>
                  ) : (
                    <>
                      <p className="font-semibold">
                        {c.day.title} · {c.day.durationMin} min
                        {c.day.timing === "fixed" && c.day.startTime ? ` · ${c.day.startTime}` : ""}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {c.day.exercises.map((e) => (
                          <li key={e.name} className={clsx("flex justify-between gap-2", c.kind === "changed" && c.added.includes(e.name) && "text-green")}>
                            <span>{e.name}</span>
                            <span className="text-label-2 tabular-nums">
                              {e.sets}
                              {e.reps ? ` × ${e.reps}` : " sets"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {c.kind === "changed" && c.dropped.length > 0 && <p className="mt-1 text-red">Drops: {c.dropped.join(", ")}</p>}
                    </>
                  )}
                </div>
              ))}
            </>
          );
        }}
      />
    </div>
  );
}
