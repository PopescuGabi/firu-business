"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/** Order of the main sections, left to right, for the direction pages slide in from. */
const SECTIONS = ["/", "/today", "/calendar", "/email", "/clients", "/instagram", "/portfolio", "/settings"];

function placeOf(path: string) {
  const section = SECTIONS.reduce((best, s, i) => (s !== "/" && path.startsWith(s) ? i : best), 0);
  return { section, depth: path.split("/").filter(Boolean).length };
}

let lastPage: { section: number; depth: number } | null = null;
const lastIndex = new Map<string, number>();

type Direction = "right" | "left" | "up";
const ENTER: Record<Direction, string> = { right: "enter-right", left: "enter-left", up: "enter-up" };

/** Slides a page in from the side of the tab you came from (deeper pages come in from the right). */
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [dir] = useState<Direction>(() => {
    const now = placeOf(path);
    if (!lastPage) return "up";
    if (now.section !== lastPage.section) return now.section > lastPage.section ? "right" : "left";
    if (now.depth !== lastPage.depth) return now.depth > lastPage.depth ? "right" : "left";
    return "up";
  });
  useEffect(() => {
    lastPage = placeOf(path);
  }, [path]);
  return <div className={ENTER[dir]}>{children}</div>;
}

/** Slides content left/right when `index` changes within a group (tabs, weeks). */
export function Slide({ group, index, children, className }: { group: string; index: number; children: ReactNode; className?: string }) {
  return (
    <SlideIn key={index} group={group} index={index} className={className}>
      {children}
    </SlideIn>
  );
}

function SlideIn({ group, index, children, className }: { group: string; index: number; children: ReactNode; className?: string }) {
  // Decided once per mount, so later re-renders don't cut the animation short.
  const [dir] = useState<Direction | null>(() => {
    const prev = lastIndex.get(group);
    return prev === undefined || prev === index ? null : index > prev ? "right" : "left";
  });
  useEffect(() => {
    lastIndex.set(group, index);
  }, [group, index]);
  return <div className={clsx(dir && ENTER[dir], className)}>{children}</div>;
}

/** iOS-style segmented control made of links, with a highlight that slides to the tapped item straight away. */
export function SegmentedLinks({
  items,
  active,
  label,
  className,
}: {
  items: { key: string; href: string; label: string; icon?: ReactNode }[];
  active: string;
  label: string;
  className?: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState(active);
  if (seen !== active) {
    setSeen(active);
    setPending(null);
  }
  const current = pending ?? active;
  const refs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current.get(current);
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [current]);
  return (
    <nav aria-label={label} className={clsx("chrome relative inline-flex rounded-full p-1", className)}>
      {pill && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ left: pill.left, width: pill.width, background: "var(--orb)", boxShadow: "var(--glow)" }}
        />
      )}
      {items.map((it) => (
        <Link
          key={it.key}
          ref={(el) => {
            if (el) refs.current.set(it.key, el);
            else refs.current.delete(it.key);
          }}
          href={it.href}
          aria-current={active === it.key ? "page" : undefined}
          onClick={() => setPending(it.key)}
          className={clsx(
            "relative z-[1] flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors duration-300",
            current === it.key ? "font-semibold text-white" : "text-label-2 hover:text-label",
            !pill && current === it.key && "orb-btn-on",
          )}
        >
          {it.icon} {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** The link you just tapped, until its page arrives (so the tab highlight moves on tap, not after loading). */
export function usePendingHref() {
  const path = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setPending(null);
  }
  return { path, pending, setPending };
}
