import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import clsx from "clsx";
import { ClearSuggestions } from "@/components/clear-suggestions";
import { ClashNotice } from "@/components/clash-notice";
import { Sheet } from "@/components/sheet";
import { acceptBlockForm, removeBlock } from "@/app/actions/tasks";
import { PlanButton } from "@/components/plan-button";
import { buttonClass, Notice, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { KIND_COLORS } from "@/lib/kinds";
import { getSettings } from "@/lib/settings";
import { addDays, mondayOf, toHHMM, toMin, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/time";
import { countSuggestions, getWeek, nowMinutesIn, todayIn } from "@/lib/week";

export const metadata = { title: "Calendar" };

const HOUR_PX = 52;

type Ev = { key: string; start: number; end: number; title: string; color: string; sub?: string; reason?: string; block?: { id: number; accepted: boolean } };

/** Side-by-side columns for overlapping events. */
function layout(events: Ev[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (Ev & { col: number; cols: number })[] = [];
  let group: (Ev & { col: number; cols: number })[] = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => (g.cols = cols));
    out.push(...group);
    group = [];
  };
  for (const e of sorted) {
    if (e.start >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    const used = new Set(group.filter((g) => g.end > e.start).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ...e, col, cols: 1 });
    groupEnd = Math.max(groupEnd, e.end);
  }
  flush();
  return out;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const settings = await getSettings();
  const today = todayIn(settings.timezone);
  const { week } = await searchParams;
  const start = mondayOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const { days, calendarError, googleConnected } = await getWeek(start, 7);
  const now = nowMinutesIn(settings.timezone);

  const firstHour = Math.floor(toMin(settings.dayStart) / 60);
  const lastHour = Math.ceil(toMin(settings.dayEnd) / 60);
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const top = (m: number) => ((m - firstHour * 60) / 60) * HOUR_PX;
  const end = addDays(start, 6);
  const range = `${new Date(`${start}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – ${new Date(`${end}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;

  return (
    <>
      <PageHeader
        subtitle={range}
        title="Calendar"
        actions={
          <>
            <div className="flex items-center rounded-full bg-fill p-0.5">
              <Link href={`/calendar?week=${addDays(start, -7)}`} aria-label="Previous week" className="grid size-8 place-items-center rounded-full hover:bg-fill-2">
                <ChevronLeft size={18} />
              </Link>
              <Link href="/calendar" className="px-3 text-[14px] font-semibold">Today</Link>
              <Link href={`/calendar?week=${addDays(start, 7)}`} aria-label="Next week" className="grid size-8 place-items-center rounded-full hover:bg-fill-2">
                <ChevronRight size={18} />
              </Link>
            </div>
            <ClearSuggestions count={await countSuggestions()} />
            <PlanButton claudeConfigured={env.claudeConfigured()} />
          </>
        }
      />
      {!googleConnected && (
        <Notice tone="orange">
          Showing school, gym and plan blocks only. <Link href="/settings" className="font-semibold text-blue">Connect Google Calendar</Link> to see everything else.
        </Notice>
      )}
      {calendarError && <Notice tone="red">Couldn&apos;t load Google Calendar: {calendarError}</Notice>}
      <ClashNotice days={days} />

      <div className="overflow-x-auto rounded-xl bg-card shadow-apple">
        <div className="min-w-[860px]">
          <div className="sticky top-0 z-10 grid grid-cols-[52px_repeat(7,1fr)] border-b border-separator bg-card">
            <div />
            {days.map((d) => (
              <div key={d.date} className="border-l border-separator px-2 py-2 text-center">
                <p className="text-[11px] font-semibold text-label-2 uppercase">{WEEKDAYS_SHORT[d.weekday - 1]}</p>
                <p
                  className={clsx(
                    "mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-[17px] font-semibold",
                    d.date === today && "bg-red text-white",
                  )}
                >
                  {Number(d.date.slice(8))}
                </p>
                {d.gym && !d.gymFixed && (
                  <p className="mt-1 truncate rounded px-1 text-[11px] font-medium text-orange" style={{ background: "color-mix(in srgb, var(--orange) 15%, transparent)" }} title={`Gym day: ${d.gym.title}`}>
                    Gym · {d.gym.title}
                  </p>
                )}
                {d.allDay.map((e) => (
                  <p key={e.id} className="mt-1 truncate rounded px-1 text-[11px] text-white" style={{ background: e.color }}>
                    {e.title}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div className="relative grid grid-cols-[52px_repeat(7,1fr)]" style={{ height: hours.length * HOUR_PX }}>
            <div className="relative">
              {hours.map((h, i) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-label-2 tabular-nums" style={{ top: i * HOUR_PX }}>
                  {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const evs: Ev[] = [
                ...d.school.map((c, i) => ({ key: `s${i}`, start: c.start, end: c.end, title: c.subject, color: KIND_COLORS.school })),
                ...d.events.map((e) => ({ key: e.id, start: e.startMin, end: e.endMin, title: e.title, color: e.color, sub: e.calendarName })),
                ...(d.gymFixed && d.gym ? [{ key: "gym", start: d.gymFixed.start, end: d.gymFixed.end, title: `Gym · ${d.gym.title}`, color: KIND_COLORS.gym }] : []),
                ...d.tutoring.map((t) => ({ key: `t${t.id}`, start: toMin(t.start), end: toMin(t.end), title: `Tutoring · ${t.subject}`, color: KIND_COLORS.tutoring })),
                ...d.blocks.map((b) => ({
                  key: `b${b.id}`,
                  start: toMin(b.start),
                  end: toMin(b.end),
                  title: b.title,
                  color: KIND_COLORS[b.kind] ?? "var(--blue)",
                  block: { id: b.id, accepted: b.status === "accepted" },
                  reason: b.reason,
                })),
              ];
              return (
                <div key={d.date} className="relative border-l border-separator">
                  {hours.map((h, i) => (
                    <div key={h} className="absolute inset-x-0 border-t border-separator/60" style={{ top: i * HOUR_PX }} />
                  ))}
                  {layout(evs).map((e) => {
                    const h = Math.max(18, top(e.end) - top(e.start) - 2);
                    const proposed = e.block && !e.block.accepted;
                    const style = {
                      top: top(e.start) + 1,
                      height: h,
                      left: `calc(${(e.col / e.cols) * 100}% + 2px)`,
                      width: `calc(${100 / e.cols}% - 4px)`,
                      background: `color-mix(in srgb, ${e.color} ${proposed ? 10 : 22}%, var(--card))`,
                      borderColor: e.color,
                      borderLeft: `3px solid ${e.color}`,
                    };
                    const cls = clsx("absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight", proposed && "border border-dashed");
                    const body = (
                      <>
                        <span className="block truncate font-semibold">{e.title}</span>
                        {h > 30 && <span className="block truncate text-label-2">{toHHMM(e.start)}–{toHHMM(e.end)}</span>}
                      </>
                    );
                    if (!e.block) {
                      return (
                        <div key={e.key} className={cls} style={style} title={`${toHHMM(e.start)}–${toHHMM(e.end)} ${e.title}`}>
                          {body}
                        </div>
                      );
                    }
                    return (
                      <Sheet
                        key={e.key}
                        title={proposed ? "Suggestion" : "Planned block"}
                        trigger={body}
                        triggerLabel={`${e.title}, ${toHHMM(e.start)}–${toHHMM(e.end)}${proposed ? ", suggestion" : ""}`}
                        triggerClassName={clsx(cls, "cursor-pointer hover:brightness-110")}
                        triggerStyle={style}
                      >
                        <p className="text-[17px] font-semibold">{e.title}</p>
                        <p className="text-[14px] text-label-2">
                          {WEEKDAYS[d.weekday - 1]} {Number(d.date.slice(8))} · {toHHMM(e.start)}–{toHHMM(e.end)}
                        </p>
                        {e.reason && <p className="mt-2 text-[14px]">{e.reason}</p>}
                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                          <form action={removeBlock.bind(null, e.block.id)}>
                            <button className={buttonClass("destructive")}>
                              <Trash2 size={15} /> {proposed ? "Delete suggestion" : "Remove"}
                            </button>
                          </form>
                          {proposed && (
                            <form action={acceptBlockForm.bind(null, e.block.id)}>
                              <button className={buttonClass("filled")}>
                                <Check size={15} /> Accept
                              </button>
                            </form>
                          )}
                        </div>
                      </Sheet>
                    );
                  })}
                  {d.date === today && now >= firstHour * 60 && now <= lastHour * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red" style={{ top: top(now) }}>
                      <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-red" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-label-2">
        {[["School", "school"], ["Tutoring", "tutoring"], ["Gym", "gym"], ["Study", "study"], ["Projects & tasks", "task"]].map(([l, k]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: KIND_COLORS[k] }} /> {l}
          </span>
        ))}
        <span>Dashed = suggestion: tap it to accept or delete</span>
      </p>
    </>
  );
}
