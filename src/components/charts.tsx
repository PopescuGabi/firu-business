import clsx from "clsx";
import type { ReactNode } from "react";
import { areaPath, compact, linePath, niceMax, points, slices, ticks } from "@/lib/chart-scale";

// Charts in the Night style: plain SVG / CSS, drawn in when they appear, values on hover (title).

export const CHART_COLORS = ["var(--accent)", "var(--teal)", "var(--purple)", "var(--orange)", "var(--pink)", "var(--green)", "var(--yellow)", "var(--indigo)"];

type Fmt = (n: number) => string;

function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-label-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: it.color }} />
          {it.label}
          {it.value && <strong className="font-semibold text-label">{it.value}</strong>}
        </li>
      ))}
    </ul>
  );
}

/** Lines over time (the first series gets a soft glow area), with y ticks and some x labels. */
export function LineChart({
  labels,
  series,
  format = compact,
  height = 180,
}: {
  labels: string[];
  series: { label: string; values: number[]; color?: string }[];
  format?: Fmt;
  height?: number;
}) {
  const W = 600;
  const H = 200;
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const every = Math.max(1, Math.ceil(labels.length / 6));
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div className="flex flex-col-reverse justify-between text-right text-[10px] text-label-3 tabular-nums" style={{ height }}>
          {ticks(top).map((t) => (
            <span key={t}>{format(t)}</span>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {ticks(top).map((t) => (
              <line key={t} x1={0} x2={W} y1={H - (t / top) * H} y2={H - (t / top) * H} className="chart-grid" />
            ))}
            {series.map((s, k) => {
              const pts = points(s.values, W, H, top);
              const color = s.color ?? CHART_COLORS[k % CHART_COLORS.length];
              return (
                <g key={s.label} style={{ color }}>
                  {k === 0 && <path d={areaPath(pts, H)} className="chart-area" />}
                  <path d={linePath(pts)} pathLength={1} className="chart-line" style={{ animationDelay: `${k * 0.15}s` }} />
                </g>
              );
            })}
          </svg>
          {/* Hover targets with the exact values. */}
          <div className="absolute inset-0 flex">
            {labels.map((l, i) => (
              <div key={i} className="chart-hit flex-1" title={`${l}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(", ")}`} />
            ))}
          </div>
        </div>
        <span />
        <div className="flex justify-between text-[10px] text-label-3">
          {labels.map((l, i) => (
            <span key={i} className={clsx("min-w-0 truncate", (labels.length - 1 - i) % every ? "invisible" : "")}>
              {l}
            </span>
          ))}
        </div>
      </div>
      {series.length > 1 && <Legend items={series.map((s, k) => ({ label: s.label, color: s.color ?? CHART_COLORS[k % CHART_COLORS.length] }))} />}
    </div>
  );
}

/** Bars per label; several series sit side by side. */
export function Bars({
  labels,
  series,
  format = compact,
  height = 160,
  highlight,
}: {
  labels: string[];
  series: { label: string; values: number[]; color?: string }[];
  format?: Fmt;
  height?: number;
  highlight?: number; // index of a label to emphasise (e.g. this month)
}) {
  const top = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  return (
    <div className="flex flex-col gap-2">
      <div className="grid items-end gap-1.5" style={{ height, gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((l, i) => (
          <div key={i} className="flex h-full items-end justify-center gap-0.5" title={`${l}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(", ")}`}>
            {series.map((s, k) => (
              <span
                key={s.label}
                className={clsx("bar w-full max-w-7 rounded-t-[6px] rounded-b-[3px]", highlight === i && "bar-on")}
                style={{
                  height: `${Math.max(2, ((s.values[i] ?? 0) / top) * 100)}%`,
                  background: s.color ?? CHART_COLORS[k % CHART_COLORS.length],
                  opacity: highlight == null || highlight === i ? 1 : 0.55,
                  ["--i" as string]: i,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-1.5 text-center text-[10px] text-label-3" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((l, i) => (
          <span key={i} className={clsx("truncate", highlight === i && "font-semibold text-label")}>
            {l}
          </span>
        ))}
      </div>
      {series.length > 1 && <Legend items={series.map((s, k) => ({ label: s.label, color: s.color ?? CHART_COLORS[k % CHART_COLORS.length] }))} />}
    </div>
  );
}

/** A ring split into shares, with a value in the middle and a legend. */
export function Donut({ parts, center, sub, format = compact }: { parts: { label: string; value: number; color?: string }[]; center?: ReactNode; sub?: ReactNode; format?: Fmt }) {
  const colored = parts.map((p, k) => ({ ...p, color: p.color ?? CHART_COLORS[k % CHART_COLORS.length] }));
  const s = slices(colored);
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx={50} cy={50} r={R} className="chart-ring" />
          {s.map((p, i) => (
            <circle
              key={p.label}
              cx={50}
              cy={50}
              r={R}
              className="chart-slice"
              stroke={p.color}
              strokeDasharray={`${Math.max(0, p.share * C - (s.length > 1 ? 1.2 : 0))} ${C}`}
              strokeDashoffset={-p.start * C}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <title>{`${p.label}: ${format(p.value)} (${Math.round(p.share * 100)}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="text-[18px] leading-tight font-bold tabular-nums">{center}</p>
          {sub && <p className="text-[11px] text-label-2">{sub}</p>}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {s.length === 0 && <li className="text-label-2">Nothing yet</li>}
        {s.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
            <span className="text-label-2 tabular-nums">{Math.round(p.share * 100)}%</span>
            <strong className="w-20 text-right font-semibold tabular-nums">{format(p.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Average result by weekday × hour: the brighter, the better (e.g. when posts get the most views). */
export function Heatmap({ cells, format = compact }: { cells: (number | null)[][]; format?: Fmt }) {
  const max = Math.max(1, ...cells.flat().map((v) => v ?? 0));
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] gap-[3px]">
        {cells.map((row, d) => [
          <span key={`d${d}`} className="text-[10px] leading-[14px] text-label-3">
            {DAYS[d]}
          </span>,
          ...row.map((v, h) => (
            <span
              key={`${d}-${h}`}
              className="heat-cell"
              style={{ ["--v" as string]: v == null ? 0 : 0.12 + 0.88 * (v / max) }}
              data-empty={v == null || undefined}
              title={`${DAYS[d]} ${String(h).padStart(2, "0")}:00${v == null ? ": no posts" : `: ${format(v)} on average`}`}
            />
          )),
        ])}
      </div>
      <div className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] text-[10px] text-label-3">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 6 === 0 ? `${h}h` : ""}</span>
        ))}
      </div>
    </div>
  );
}

/** Progress toward a goal or through a budget; glows when reached, warns when over (budgets). */
export function Meter({ label, value, target, display, budget = false }: { label: ReactNode; value: number; target: number; display?: ReactNode; budget?: boolean }) {
  const pct = target > 0 ? value / target : 0;
  const tone = budget ? (pct > 1 ? "red" : pct >= 0.8 ? "orange" : "blue") : pct >= 1 ? "green" : "blue";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 text-label-2 tabular-nums">{display ?? `${Math.round(pct * 100)}%`}</span>
      </div>
      <div className="meter" data-tone={tone}>
        <span style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  );
}

/** A tiny trend line for tiles. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const W = 120;
  const H = 32;
  const pts = points(values.length ? values : [0], W, H, niceMax(Math.max(1, ...values)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={clsx("h-8 w-full overflow-visible", className)} aria-hidden>
      <path d={areaPath(pts, H)} className="chart-area" style={{ color: "currentColor" }} />
      <path d={linePath(pts)} pathLength={1} className="chart-line" />
    </svg>
  );
}

/** Bars (e.g. posts per week) with a line on its own scale (e.g. reach in the same week). */
export function ComboChart({
  labels,
  bars,
  line,
  format = compact,
  height = 170,
}: {
  labels: string[];
  bars: { label: string; values: number[]; color?: string };
  line: { label: string; values: (number | null)[]; color?: string };
  format?: Fmt;
  height?: number;
}) {
  const W = 600;
  const H = 200;
  const barTop = niceMax(Math.max(1, ...bars.values));
  const lineVals = line.values.map((v) => v ?? 0);
  const lineTop = niceMax(Math.max(1, ...lineVals));
  const n = Math.max(1, labels.length);
  const pts = lineVals.map((v, i) => ({ x: ((i + 0.5) / n) * W, y: H - (Math.max(0, v) / lineTop) * H }));
  const barColor = bars.color ?? CHART_COLORS[0];
  const lineColor = line.color ?? CHART_COLORS[3];
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return (
    <div className="flex flex-col gap-2">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {labels.map((l, i) => (
            <div key={i} className="chart-hit flex h-full items-end justify-center" title={`${l}: ${bars.label} ${format(bars.values[i] ?? 0)}, ${line.label} ${line.values[i] == null ? "–" : format(line.values[i]!)}`}>
              <span className="bar w-full max-w-7 rounded-t-[6px] rounded-b-[3px]" style={{ height: `${Math.max(2, ((bars.values[i] ?? 0) / barTop) * 100)}%`, background: barColor, opacity: 0.55, ["--i" as string]: i }} />
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden style={{ color: lineColor }}>
          <path d={linePath(pts)} pathLength={1} className="chart-line" />
        </svg>
      </div>
      <div className="grid gap-1.5 text-center text-[10px] text-label-3" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {labels.map((l, i) => (
          <span key={i} className={clsx("truncate", (labels.length - 1 - i) % every ? "invisible" : "")}>
            {l}
          </span>
        ))}
      </div>
      <Legend items={[{ label: bars.label, color: barColor }, { label: line.label, color: lineColor }]} />
    </div>
  );
}

/** Days of a period in weeks (Monday first); each day shows a dot per post, coloured by its kind. */
export function PostingCalendar({ days, colors, labels }: { days: { date: string; posts: string[] }[]; colors: Record<string, string>; labels: Record<string, string> }) {
  if (!days.length) return null;
  const lead = (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: ({ date: string; posts: string[] } | null)[] = [...Array(lead).fill(null), ...days];
  const kinds = [...new Set(days.flatMap((d) => d.posts))];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-label-3">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
        {cells.map((c, i) =>
          c ? (
            <div
              key={c.date}
              className={clsx("flex aspect-square min-h-7 flex-col items-center justify-center gap-0.5 rounded-[8px]", c.posts.length ? "bg-accent-soft" : "bg-well")}
              title={`${c.date}: ${c.posts.length ? c.posts.map((p) => labels[p] ?? p).join(", ") : "no posts"}`}
            >
              <span className={clsx("text-[10px] leading-none", c.posts.length ? "font-semibold text-label" : "text-label-3")}>{Number(c.date.slice(8))}</span>
              {c.posts.length > 0 && (
                <span className="flex gap-0.5">
                  {c.posts.slice(0, 3).map((p, k) => (
                    <span key={k} className="size-1.5 rounded-full" style={{ background: colors[p] ?? CHART_COLORS[0] }} />
                  ))}
                </span>
              )}
            </div>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
      {kinds.length > 0 && <Legend items={kinds.map((k) => ({ label: labels[k] ?? k, color: colors[k] ?? CHART_COLORS[0] }))} />}
    </div>
  );
}
