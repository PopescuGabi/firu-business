import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { GlassSurface } from "./glass";

/** A board tile: a refracting liquid glass pane that fades in after the ones before it (`i`) and lifts a little on hover. */
export function Tile({ i = 0, className, children }: { i?: number; className?: string; children: React.ReactNode }) {
  return (
    // Refracting Liquid Glass (Tier 1 in Chromium; frosted elsewhere): the backdrop bends at the edges.
    <GlassSurface as="section" radius={26} contrast="high" className="tile relative flex min-w-0 flex-col @container" style={{ ["--i" as string]: i }}>
      <div className={clsx("relative flex min-h-0 flex-1 flex-col overflow-y-auto p-4", className)}>{children}</div>
    </GlassSurface>
  );
}

/** A tile with an icon and title on the left and "Open ↗" (or an action of its own) on the right. */
export function Widget({
  title,
  icon: Icon,
  href,
  openText,
  action,
  children,
  i,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  /** The link's word ("Open" by default; "Instagram", "Tasks"… when it goes to a tab). */
  openText?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  i?: number;
  className?: string;
}) {
  return (
    <Tile i={i} className={className}>
      <header className="mb-3 flex items-center gap-2">
        <Icon size={16} className="shrink-0 text-label-2" />
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
        {action}
        {href && <OpenLink href={href} label={`Open ${title}`} text={openText} />}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </Tile>
  );
}

/** The quiet "Open ↗" link in a tile's corner. */
export function OpenLink({ href, label, text = "Open" }: { href: string; label: string; text?: string }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[13px] font-medium text-label-3 transition hover:bg-fill hover:text-label">
      {text}
      <ArrowUpRight size={14} />
    </Link>
  );
}

/** One-line empty state inside a tile: what's missing, and the action that fills it. */
export function TileEmpty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] bg-well px-3 py-2.5 text-[13px] text-label-2">
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
