import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

/**
 * The one header every page uses: a small line on top (date, account, kind of client), the title, and the page's
 * actions on the right (at most one blue button). `lead` sits before the title (a client's initial).
 */
export function PageHeader({ title, subtitle, actions, lead, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; lead?: ReactNode; className?: string }) {
  return (
    <header className={clsx("mb-5 flex flex-wrap items-end justify-between gap-3 pt-1", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {lead}
        <div className="min-w-0">
          {subtitle && <p className="mb-0.5 truncate text-[13px] text-label-2">{subtitle}</p>}
          <h1 className="truncate text-[28px] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = typeof title === "string" ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined;
  return (
    <section id={id} data-title={typeof title === "string" ? title : undefined} className={clsx("mb-8 scroll-mt-6", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2 px-4">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {footer && <p className="mt-2 px-4 text-[13px] text-label-2">{footer}</p>}
    </section>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("glass overflow-hidden rounded-[24px]", className)} {...props} />;
}

/** Columns a bento tile takes: phone (of 2), tablet (of 6), laptop and desktop (of 12); rows likewise. */
export type Span = { p?: number; t?: number; l?: number; d?: number; rp?: number; rt?: number; rl?: number; rd?: number };

/** The grid behind every bento layout; tiles inside animate in one after another. */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("bento", className)}>
      <div className="bento-grid">{children}</div>
    </div>
  );
}

export function spanStyle(span: Span, index: number): React.CSSProperties {
  const vars: Record<string, number> = { "--i": index };
  for (const [k, v] of Object.entries(span)) if (v) vars[`--${k}`] = v;
  return vars as React.CSSProperties;
}

/** A grouped list: rows separated by inset hairlines, like iOS Settings. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={clsx("divide-y divide-separator [&>*]:ml-4 [&>*]:pl-0 [&>*:first-child]:ml-0 [&>*:first-child]:pl-4", className)}>
      {children}
    </Card>
  );
}

export function Row({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("flex min-h-11 items-center gap-3 py-2.5 pr-4 pl-4", className)} {...props} />;
}

type ButtonVariant = "filled" | "tinted" | "plain" | "gray" | "destructive";
const buttonStyles: Record<ButtonVariant, string> = {
  filled: "liquid text-white", // blue glass; LiquidButton adds the fill (globals.css)
  tinted: "bg-accent-soft text-accent hover:brightness-[0.97]",
  gray: "btn-glass", // a glass pill (globals.css)
  plain: "text-accent hover:bg-fill",
  destructive: "bg-red/12 text-red hover:bg-red/20",
};

export function buttonClass(variant: ButtonVariant = "filled", size: "sm" | "md" | "lg" = "md") {
  return clsx(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full font-semibold transition select-none active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 disabled:opacity-40",
    size === "sm" && "h-7 px-3 text-[13px]",
    size === "md" && "h-9 px-4 text-[15px]",
    size === "lg" && "h-11 px-6 text-[17px]",
    buttonStyles[variant],
  );
}

/** Small in-page toggles (radio groups), matching SegmentedLinks: a sunken track with a glass pane on the chosen one. */
export const segmentGroupClass = "seg-track inline-flex rounded-full p-[3px]";
export function segmentClass(on: boolean) {
  return clsx(
    "cursor-pointer rounded-full font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
    on ? "sel-pane font-semibold text-label" : "text-label-2 hover:text-label",
  );
}

export const STATUS_COLORS: Record<string, string> = {
  idea: "var(--label-2)",
  scripting: "var(--purple)",
  filming: "var(--orange)",
  editing: "var(--blue)",
  review: "var(--yellow)",
  posted: "var(--green)",
  draft: "var(--label-2)",
  approved: "var(--teal)",
  planned: "var(--label-2)",
  in_progress: "var(--blue)",
  shipped: "var(--green)",
};

export function Pill({ children, color = "var(--label-2)" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[12px] font-semibold whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

export const statusLabel = (s: string) => s.replace("_", " ").replace(/^./, (c) => c.toUpperCase());

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-label-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block px-1 text-[12px] text-label-2">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-label-3">{icon}</div>}
      <p className="text-[17px] font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[14px] text-label-2">{children}</div>}
    </Card>
  );
}

export function Notice({ tone = "blue", children }: { tone?: "blue" | "orange" | "red" | "green"; children: ReactNode }) {
  const color = `var(--${tone})`;
  return (
    <div
      className="mb-4 rounded-2xl px-4 py-3 text-[14px]"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color: "var(--label)" }}
    >
      {children}
    </div>
  );
}

export type Stop = { title: ReactNode; sub?: ReactNode; state?: "here" | "next" | "later" };

/** Stops joined by a line, like a route: a filled dot where you are, rings for what's next. */
export function RouteTimeline({ stops, className }: { stops: Stop[]; className?: string }) {
  return (
    <ol className={clsx("route", className)}>
      {stops.map((s, k) => (
        <li key={k} className="route-stop" data-state={s.state ?? (k === 0 ? "here" : k === 1 ? "next" : "later")}>
          <span className="route-mark" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{s.title}</p>
            {s.sub && <p className="truncate text-[12px] text-label-2">{s.sub}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A small rounded stat chip (icon + value), like the ones laid over the map. */
export function Chip({ icon, children, tone, className }: { icon?: ReactNode; children: ReactNode; tone?: "orange" | "red" | "blue"; className?: string }) {
  return (
    <span className={clsx("chip", className)} data-tone={tone}>
      {icon}
      {children}
    </span>
  );
}
