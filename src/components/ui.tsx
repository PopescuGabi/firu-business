import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{subtitle}</p>}
        <h1 className="truncate text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
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
  return (
    <section className={clsx("mb-8", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2 px-4">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {footer && <p className="mt-2 px-4 text-[13px] text-label-2">{footer}</p>}
    </section>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("overflow-hidden rounded-xl bg-card shadow-apple", className)} {...props} />;
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
  filled: "bg-blue text-white hover:brightness-110 active:brightness-95",
  tinted: "bg-blue/15 text-blue hover:bg-blue/20",
  gray: "bg-fill text-label hover:bg-fill-2",
  plain: "text-blue hover:bg-fill",
  destructive: "bg-red/12 text-red hover:bg-red/20",
};

export function buttonClass(variant: ButtonVariant = "filled", size: "sm" | "md" | "lg" = "md") {
  return clsx(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" && "h-7 px-3 text-[13px]",
    size === "md" && "h-9 px-4 text-[15px]",
    size === "lg" && "h-11 px-6 text-[17px]",
    buttonStyles[variant],
  );
}

export function Button({
  variant = "filled",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <button className={clsx(buttonClass(variant, size), className)} {...props} />;
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
      className="mb-4 rounded-xl px-4 py-3 text-[14px]"
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color: "var(--label)" }}
    >
      {children}
    </div>
  );
}
