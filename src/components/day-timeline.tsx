import { Dumbbell } from "lucide-react";
import clsx from "clsx";
import { acceptBlock, removeBlock } from "@/app/actions/tasks";
import { BlockActions } from "./block-actions";
import { ContextMenu, type MenuItem } from "./context-menu";
import { eventMenu } from "./event-menu";
import { Empty, List, Pill, Row } from "./ui";
import { KIND_COLORS } from "@/lib/kinds";
import { clock, toHHMM, toMin } from "@/lib/time";
import type { PlanAdvice } from "@/lib/settings-defaults";
import type { DayView } from "@/lib/week";

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
  // Real start/end when the item runs past midnight; otherwise the clipped times are shown.
  times?: [string, string];
  menu?: MenuItem[];
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
    const [from, to] = e.label.split("–");
    items.push({
      key: e.id,
      start: e.startMin,
      end: e.endMin,
      title: e.title,
      color: e.color,
      detail: e.calendarName,
      times: [from.includes(" ") ? clock(e.startMin) : from, to], // "Thu 23:00" is too wide here
      menu: e.writable ? eventMenu(e) : undefined,
    });
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
      menu:
        b.status === "accepted"
          ? [{ label: "Remove from plan", destructive: true, action: removeBlock.bind(null, b.id) }]
          : [
              { label: "Accept", action: acceptBlock.bind(null, b.id) },
              { label: "Delete suggestion", destructive: true, action: removeBlock.bind(null, b.id) },
            ],
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
        <ContextMenu key={e.id} items={e.writable ? eventMenu(e) : []} className="flex min-h-11 items-center gap-3 py-2.5 pr-4 pl-4 text-[14px]">
          <span className="size-2.5 rounded-full" style={{ background: e.color }} />
          <span className="flex-1">{e.title}</span>
          <span className="text-label-2">All day</span>
        </ContextMenu>
      ))}
      {items.map((it) => {
        const past = it.end <= now;
        const current = it.start <= now && now < it.end;
        return (
          <ContextMenu key={it.key} items={it.menu ?? []} className={clsx("flex min-h-11 items-center gap-3 py-2.5 pr-4 pl-4", past && "opacity-50")}>
            <div className="w-[52px] shrink-0 text-right text-[13px] tabular-nums">
              <p className="font-semibold">{it.times?.[0] ?? clock(it.start)}</p>
              <p className="text-label-2">{it.times?.[1] ?? clock(it.end)}</p>
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
          </ContextMenu>
        );
      })}
    </List>
  );
}

/** Today's recommended study / project / gym minutes. */
export function TargetStats({ target }: { target: PlanAdvice["dailyTargets"][number] }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <Stat label="Study" value={fmtMin(target.studyMin)} color="var(--purple)" />
      <Stat label="Projects" value={fmtMin(target.projectMin)} color="var(--blue)" />
      <Stat label="Gym" value={target.gymMin ? fmtMin(target.gymMin) : "Rest"} color="var(--orange)" />
    </div>
  );
}
