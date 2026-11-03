import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { ClearSuggestions } from "@/components/clear-suggestions";
import { CalendarNotices } from "@/components/clash-notice";
import type { MenuItem } from "@/components/context-menu";
import { EventForm, type EditableEvent } from "@/components/event-form";
import { eventMenu } from "@/components/event-menu";
import { Slide } from "@/components/motion";
import { Sheet } from "@/components/sheet";
import { acceptBlock, removeBlock } from "@/app/actions/tasks";
import { PlanButton } from "@/components/plan-button";
import { buttonClass, PageHeader } from "@/components/ui";
import { env } from "@/lib/env";
import { listCalendars, type CalendarEvent } from "@/lib/google/calendar";
import { HUB_CALENDAR_NAME } from "@/lib/calendar-sync";
import { KIND_COLORS } from "@/lib/kinds";
import { getSettings } from "@/lib/settings";
import { addDays, clock, fmtDate, mondayOf, toMin, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/time";
import { countSuggestions, getWeek, nowMinutesIn, todayIn, type DayView } from "@/lib/week";

export const metadata = { title: "Calendar" };

const HOUR_PX = 52;

type Ev = {
  key: string;
  start: number;
  end: number;
  title: string;
  color: string;
  label: string;
  sub?: string;
  reason?: string;
  block?: { id: number; accepted: boolean };
  edit?: EditableEvent;
  menu?: MenuItem[];
};

const span = (start: number, end: number) => `${clock(start)}–${clock(end)}`;

/** Everything shown in a day's column. */
function dayEvents(d: DayView, tz: string): Ev[] {
  return [
    ...d.school.map((c, i) => ({
      key: `s${i}`,
      start: c.start,
      end: c.end,
      label: span(c.start, c.end),
      title: c.subject,
      color: KIND_COLORS.school,
    })),
    ...d.events.map((e) => ({
      key: e.id,
      start: e.startMin,
      end: e.endMin,
      label: e.label,
      title: e.title,
      color: e.color,
      sub: e.calendarName,
      edit: e.writable ? editable(e, tz) : undefined,
      menu: e.writable ? eventMenu(e) : undefined,
    })),
    ...(d.gymFixed && d.gym
      ? [
          {
            key: "gym",
            start: d.gymFixed.start,
            end: d.gymFixed.end,
            label: span(d.gymFixed.start, d.gymFixed.end),
            title: `Gym · ${d.gym.title}`,
            color: KIND_COLORS.gym,
          },
        ]
      : []),
    ...d.tutoring.map((t) => ({
      key: `t${t.id}`,
      start: toMin(t.start),
      end: toMin(t.end),
      label: `${t.start}–${t.end}`,
      title: `Tutoring · ${t.subject}`,
      color: KIND_COLORS.tutoring,
    })),
    ...d.blocks.map((b) => {
      const accepted = b.status === "accepted";
      return {
        key: `b${b.id}`,
        start: toMin(b.start),
        end: toMin(b.end),
        label: `${b.start}–${b.end}`,
        title: b.title,
        color: KIND_COLORS[b.kind] ?? "var(--blue)",
        block: { id: b.id, accepted },
        reason: b.reason,
        menu: accepted
          ? [{ label: "Remove from plan", destructive: true, action: removeBlock.bind(null, b.id) }]
          : [
              { label: "Accept", action: acceptBlock.bind(null, b.id) },
              { label: "Delete suggestion", destructive: true, action: removeBlock.bind(null, b.id) },
            ],
      };
    }),
  ];
}

/** A Google event as the edit form needs it (local date and times). */
function editable(e: CalendarEvent, tz: string): EditableEvent {
  const local = (iso: string) => new TZDate(iso, tz);
  const base = {
    id: e.id,
    calendarId: e.calendarId,
    seriesId: e.recurringEventId,
    title: e.title,
    location: e.location,
    notes: e.description,
  };
  if (e.allDay)
    return {
      ...base,
      allDay: true,
      date: e.start,
      endDate: addDays(e.end, -1),
      start: "",
      end: "",
    };
  const s = local(e.start);
  const en = local(e.end);
  return {
    ...base,
    allDay: false,
    date: format(s, "yyyy-MM-dd"),
    endDate: format(en, "yyyy-MM-dd"),
    start: format(s, "HH:mm"),
    end: format(en, "HH:mm"),
  };
}

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
  const writable = googleConnected && !calendarError ? (await listCalendars()).filter((c) => c.writable) : [];
  const hubCal = writable.find((c) => c.name.trim().toLowerCase() === HUB_CALENDAR_NAME.toLowerCase());
  const formProps = {
    calendars: writable.map(({ id, name, color }) => ({ id, name, color })),
    defaultCalendarId: hubCal?.id ?? writable.find((c) => c.primary)?.id ?? writable[0]?.id ?? "primary",
    places: [...new Set(Object.keys(settings.travel).flatMap((k) => k.split(">")))].filter((p) => p !== "online"),
  };

  const columns = days.map((d) => ({ day: d, evs: dayEvents(d, settings.timezone) }));
  // The grid covers your day window, stretched to fit anything earlier or later (e.g. a game until midnight).
  const all = columns.flatMap((c) => c.evs);
  const firstHour = Math.floor(Math.min(toMin(settings.dayStart), ...all.map((e) => e.start)) / 60);
  const lastHour = Math.ceil(Math.max(toMin(settings.dayEnd), ...all.map((e) => e.end)) / 60);
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const top = (m: number) => ((m - firstHour * 60) / 60) * HOUR_PX;
  const end = addDays(start, 6);
  const range = `${fmtDate(start, { day: "numeric", month: "short" })} – ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <PageHeader
        subtitle={range}
        title="Calendar"
        actions={
          <>
            <div className="flex items-center rounded-full bg-fill p-0.5">
              <Link
                href={`/calendar?week=${addDays(start, -7)}`}
                aria-label="Previous week"
                className="grid size-8 place-items-center rounded-full hover:bg-fill-2"
              >
                <ChevronLeft size={18} />
              </Link>
              <Link href="/calendar" className="px-3 text-[14px] font-semibold">
                Today
              </Link>
              <Link
                href={`/calendar?week=${addDays(start, 7)}`}
                aria-label="Next week"
                className="grid size-8 place-items-center rounded-full hover:bg-fill-2"
              >
                <ChevronRight size={18} />
              </Link>
            </div>
            {writable.length > 0 && (
              <Sheet
                title="New event"
                trigger={
                  <>
                    <Plus size={16} /> Event
                  </>
                }
                triggerClassName={buttonClass("tinted")}
              >
                <EventForm {...formProps} defaultDate={today >= start && today <= end ? today : start} />
              </Sheet>
            )}
            <ClearSuggestions count={await countSuggestions()} />
            <PlanButton claudeConfigured={env.claudeConfigured()} />
          </>
        }
      />
      <CalendarNotices
        days={days}
        googleConnected={googleConnected}
        calendarError={calendarError}
        notConnected={
          <>
            Showing school, gym and plan blocks only.{" "}
            <Link href="/settings" className="font-semibold text-blue">
              Connect Google Calendar
            </Link>{" "}
            to see everything else.
          </>
        }
      />

      <Slide group="calendar-week" index={Math.round(Date.parse(start) / 604_800_000)}>
        <div className="glass overflow-x-auto rounded-[24px]">
          <div className="min-w-[860px]">
            <div className="sticky top-0 z-10 grid grid-cols-[52px_repeat(7,1fr)] border-b border-separator bg-card-solid/80 backdrop-blur-xl">
              <div />
              {days.map((d) => (
                <div key={d.date} className="border-l border-separator px-2 py-2 text-center">
                  <p className="text-[11px] font-semibold text-label-2 uppercase">{WEEKDAYS_SHORT[d.weekday - 1]}</p>
                  {writable.length > 0 ? (
                    <Sheet
                      title={`New event · ${WEEKDAYS[d.weekday - 1]} ${Number(d.date.slice(8))}`}
                      trigger={Number(d.date.slice(8))}
                      triggerLabel={`Add an event on ${WEEKDAYS[d.weekday - 1]} ${Number(d.date.slice(8))}`}
                      triggerClassName={clsx(
                        "mx-auto mt-0.5 grid size-8 cursor-pointer place-items-center rounded-full text-[17px] font-semibold transition hover:bg-fill",
                        d.date === today && "bg-red text-white hover:bg-red",
                      )}
                    >
                      <EventForm {...formProps} defaultDate={d.date} />
                    </Sheet>
                  ) : (
                    <p
                      className={clsx(
                        "mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-[17px] font-semibold",
                        d.date === today && "bg-red text-white",
                      )}
                    >
                      {Number(d.date.slice(8))}
                    </p>
                  )}
                  {d.gym && !d.gymFixed && (
                    <p
                      className="mt-1 truncate rounded px-1 text-[11px] font-medium text-orange"
                      style={{
                        background: "color-mix(in srgb, var(--orange) 15%, transparent)",
                      }}
                      title={`Gym day: ${d.gym.title}`}
                    >
                      Gym · {d.gym.title}
                    </p>
                  )}
                  {d.allDay.map((e) =>
                    e.writable ? (
                      <Sheet
                        key={e.id}
                        title="Event"
                        trigger={e.title}
                        triggerLabel={`${e.title}, all day`}
                        triggerClassName="mt-1 block w-full cursor-pointer truncate rounded px-1 text-left text-[11px] text-white hover:brightness-110"
                        triggerStyle={{ background: e.color }}
                        menu={eventMenu(e)}
                        openLabel="Edit…"
                      >
                        <EventForm {...formProps} defaultDate={d.date} event={editable(e, settings.timezone)} />
                      </Sheet>
                    ) : (
                      <p key={e.id} className="mt-1 truncate rounded px-1 text-[11px] text-white" style={{ background: e.color }}>
                        {e.title}
                      </p>
                    ),
                  )}
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
              {columns.map(({ day: d, evs }) => {
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
                        background: `color-mix(in srgb, ${e.color} ${proposed ? 10 : 22}%, var(--card-solid))`,
                        borderColor: e.color,
                        borderLeft: `3px solid ${e.color}`,
                      };
                      const cls = clsx(
                        "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight",
                        proposed && "border border-dashed",
                      );
                      const body = (
                        <>
                          <span className="block truncate font-semibold">{e.title}</span>
                          {h > 30 && (
                            <span className="block truncate text-label-2">
                              {e.label}
                            </span>
                          )}
                        </>
                      );
                      if (e.edit) {
                        return (
                          <Sheet
                            key={e.key}
                            title="Event"
                            trigger={body}
                            triggerLabel={`${e.title}, ${e.label}`}
                            triggerClassName={clsx(cls, "cursor-pointer hover:brightness-110")}
                            triggerStyle={style}
                            menu={e.menu}
                            openLabel="Edit…"
                          >
                            <EventForm {...formProps} defaultDate={d.date} event={e.edit} />
                          </Sheet>
                        );
                      }
                      if (!e.block) {
                        return (
                          <div key={e.key} className={cls} style={style} title={`${e.label} ${e.title}`}>
                            {body}
                          </div>
                        );
                      }
                      return (
                        <Sheet
                          key={e.key}
                          title={proposed ? "Suggestion" : "Planned block"}
                          trigger={body}
                          triggerLabel={`${e.title}, ${e.label}${proposed ? ", suggestion" : ""}`}
                          triggerClassName={clsx(cls, "cursor-pointer hover:brightness-110")}
                          triggerStyle={style}
                          menu={e.menu}
                        >
                          <p className="text-[17px] font-semibold">{e.title}</p>
                          <p className="text-[14px] text-label-2">
                            {WEEKDAYS[d.weekday - 1]} {Number(d.date.slice(8))} · {e.label}
                          </p>
                          {e.reason && <p className="mt-2 text-[14px]">{e.reason}</p>}
                          <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <form action={removeBlock.bind(null, e.block.id)}>
                              <button className={buttonClass("destructive")}>
                                <Trash2 size={15} /> {proposed ? "Delete suggestion" : "Remove"}
                              </button>
                            </form>
                            {proposed && (
                              <form action={acceptBlock.bind(null, e.block.id)}>
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
      </Slide>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-label-2">
        {[
          ["School", "school"],
          ["Tutoring", "tutoring"],
          ["Gym", "gym"],
          ["Study", "study"],
          ["Projects & tasks", "task"],
        ].map(([l, k]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: KIND_COLORS[k] }} /> {l}
          </span>
        ))}
        <span>Dashed = suggestion: tap it to accept or delete</span>
        {writable.length > 0 && <span>Tap a date to add an event, or an event to edit it. Right-click an event to delete it</span>}
      </p>
    </>
  );
}
