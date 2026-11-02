import { Dumbbell } from "lucide-react";
import { BlockActions } from "./block-actions";
import { Empty, List, Pill, Row } from "./ui";
import { KIND_COLORS } from "@/lib/kinds";
import { toHHMM, toMin } from "@/lib/time";
import type { DayView } from "@/lib/week";

export type PlanAdvice = {
  advice: string;
  dailyTargets: { date: string; studyMin: number; projectMin: number; gymMin: number; note: string }[];
  createdAt: string;
  source: "ai" | "basic";
};

export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

export function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg py-2" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      <p className="text-[19px] font-semibold" style={{ color }}>{value}</p>
      <p className="text-[12px] text-label-2">{label}</p>
    </div>
  );
}

type Item = {
  key: string;
  start: number;
  end: number;
  title: string;
  color: string;
  detail?: React.ReactNode;
  block?: { id: number; accepted: boolean };
};

export function Timeline({ day, now }: { day: DayView; now: number }) {
  const items: Item[] = [];
  if (day.school.length) {
    items.push({
      key: "school",
      start: day.school[0].start,
      end: day.school.at(-1)!.end,
      title: "School",
      color: KIND_COLORS.school,
      detail: (
        <span className="mt-1 flex flex-wrap gap-1">
          {day.school.map((c, i) => (
            <Pill key={i} color={c.end <= now ? "var(--label-3)" : KIND_COLORS.school}>
              {toHHMM(c.start)} {c.subject}
            </Pill>
          ))}
        </span>
      ),
    });
  }
  for (const e of day.events) {
    items.push({ key: e.id, start: e.startMin, end: e.endMin, title: e.title, color: e.color, detail: e.calendarName });
  }
  if (day.gymFixed && day.gym) {
    items.push({
      key: "gym",
      start: day.gymFixed.start,
      end: day.gymFixed.end,
      title: `Gym · ${day.gym.title}`,
      color: KIND_COLORS.gym,
      detail: day.gym.timing === "after_school" ? "Right after school" : undefined,
    });
  }
  for (const t of day.tutoring) {
    items.push({ key: `t${t.id}`, start: toMin(t.start), end: toMin(t.end), title: `Tutoring · ${t.subject}`, color: KIND_COLORS.tutoring });
  }
  for (const b of day.blocks) {
    items.push({
      key: `b${b.id}`,
      start: toMin(b.start),
      end: toMin(b.end),
      title: b.title,
      color: KIND_COLORS[b.kind] ?? "var(--blue)",
      detail: (
        <>
          {b.status === "proposed" && <Pill color="var(--blue)">{b.source === "ai" ? "AI suggestion" : "Suggestion"}</Pill>}{" "}
          {b.reason}
        </>
      ),
      block: { id: b.id, accepted: b.status === "accepted" },
    });
  }
  items.sort((a, b) => a.start - b.start);

  const gymPlanned = Boolean(day.gymFixed) || day.blocks.some((b) => b.kind === "gym");
  if (!items.length && !day.gym) {
    return <Empty title="Nothing scheduled">Enjoy the free day, or plan some project work.</Empty>;
  }
  return (
    <List>
      {day.gym && !gymPlanned && (
        <Row className="text-[14px]">
          <Dumbbell size={16} className="text-orange" />
          <span className="flex-1">
            Gym day: <strong>{day.gym.title}</strong> · {day.gym.durationMin} min. Plan your week to find the best time.
          </span>
        </Row>
      )}
      {day.allDay.map((e) => (
        <Row key={e.id} className="text-[14px]">
          <span className="size-2.5 rounded-full" style={{ background: e.color }} />
          <span className="flex-1">{e.title}</span>
          <span className="text-label-2">All day</span>
        </Row>
      ))}
      {items.map((it) => {
        const past = it.end <= now;
        const current = it.start <= now && now < it.end;
        return (
          <Row key={it.key} className={past ? "opacity-50" : undefined}>
            <div className="w-[52px] shrink-0 text-right text-[13px] tabular-nums">
              <p className="font-semibold">{toHHMM(it.start)}</p>
              <p className="text-label-2">{toHHMM(it.end)}</p>
            </div>
            <span className="w-1 self-stretch rounded-full" style={{ background: it.color, opacity: it.block && !it.block.accepted ? 0.4 : 1 }} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {it.title}
                {current && <span className="ml-2 text-[12px] font-semibold text-red">NOW</span>}
              </p>
              {it.detail && <div className="text-[13px] text-label-2">{it.detail}</div>}
            </div>
            {it.block && <BlockActions id={it.block.id} accepted={it.block.accepted} />}
          </Row>
        );
      })}
    </List>
  );
}
