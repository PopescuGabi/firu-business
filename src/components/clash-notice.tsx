import Link from "next/link";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { WEEKDAYS } from "@/lib/time";
import type { DayView } from "@/lib/week";
import { Notice } from "./ui";

/** The notices above a schedule: Google not connected (with this page's own wording), a Calendar error, travel clashes. */
export function CalendarNotices({
  days,
  googleConnected,
  calendarError,
  notConnected,
}: {
  days: DayView[];
  googleConnected: boolean;
  calendarError: string | null;
  notConnected: ReactNode;
}) {
  return (
    <>
      {!googleConnected && <Notice tone="orange">{notConnected}</Notice>}
      {calendarError && <Notice tone="red">Couldn&apos;t load Google Calendar: {calendarError}</Notice>}
      <ClashNotice days={days} />
    </>
  );
}

/** Lists fixed sessions that don't leave enough travel time between them. */
function ClashNotice({ days }: { days: DayView[] }) {
  const clashes = days.flatMap((d) => d.clashes.map((c) => ({ ...c, date: d.date, weekday: d.weekday })));
  if (!clashes.length) return null;
  return (
    <div role="alert" className="mb-4 rounded-2xl bg-red/12 px-4 py-3 text-[14px]">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-red">
        <TriangleAlert size={16} /> Not enough travel time
      </p>
      <ul className="space-y-0.5">
        {clashes.map((c, i) => (
          <li key={i}>
            <span className="font-medium">
              {WEEKDAYS[c.weekday - 1]} {Number(c.date.slice(8))}:
            </span>{" "}
            {c.message}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[13px] text-label-2">
        Change the session in <Link href="/school" className="font-semibold text-blue">School</Link> or the travel times in{" "}
        <Link href="/settings" className="font-semibold text-blue">Settings</Link>.
      </p>
    </div>
  );
}
