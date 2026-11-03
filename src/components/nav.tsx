"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LogoMark } from "./logo";
import { usePendingHref } from "./motion";
import { BookText, Briefcase, CalendarDays, GraduationCap, House, Plus, Settings, Sun } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/today", label: "Today", icon: Sun },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/school", label: "School", icon: GraduationCap },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/prompts", label: "Prompts", icon: BookText },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));
/** The one link to highlight: the most specific match (a client over "Clients"). */
const activeOf = (path: string, hrefs: string[]) =>
  hrefs.filter((h) => isActive(path, h.split("?")[0])).sort((a, b) => b.length - a.length)[0] ?? null;

/**
 * A highlight that glides to the active link and squashes a little as it lands, like a drop of liquid.
 * Links register themselves; the highlight is measured against their shared positioned parent.
 */
function useGlide(active: string | null, squash: [number, number]) {
  const links = useRef(new Map<string, HTMLElement>());
  const blob = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const first = useRef(true);
  const register = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) links.current.set(key, el);
      else links.current.delete(key);
    },
    [],
  );
  useLayoutEffect(() => {
    const measure = () => {
      const el = active ? links.current.get(active) : undefined;
      setBox(el ? { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight } : null);
    };
    measure();
    if (!first.current && active && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      blob.current?.animate(
        [{ transform: "scale(1)" }, { transform: `scale(${squash[0]}, ${squash[1]})`, offset: 0.45 }, { transform: "scale(1)" }],
        { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
    first.current = false;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, squash]);
  return { register, blob, box };
}

const RAIL_SQUASH: [number, number] = [0.84, 1.2];
const DOCK_SQUASH: [number, number] = [1.12, 0.86];

/** A round rail button with a tooltip to its right. */
function RailLink({
  href,
  label,
  active,
  glided,
  linkRef,
  onClick,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  glided: boolean; // the gliding highlight is drawn behind it, so no background of its own
  linkRef: (el: HTMLElement | null) => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      ref={linkRef}
      href={href}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative z-[1] grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] delay-75 duration-300 active:scale-90",
        active ? "text-[#111116]" : "text-[var(--rail-icon)] hover:bg-white/10 hover:text-white",
        active && !glided && "bg-[var(--rail-active)]",
      )}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-on-ink opacity-0 shadow-apple transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </Link>
  );
}

/** Floating pill rail (tablet and up): sections, your clients, settings. */
export function Sidebar({ clients }: { clients: { id: number; name: string; color: string }[] }) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const hrefs = [...ITEMS.map((i) => i.href), ...clients.map((c) => `/clients/${c.id}`), "/settings"];
  const active = activeOf(path, hrefs);
  const { register, blob, box } = useGlide(active, RAIL_SQUASH);
  const link = (href: string, label: string, children: React.ReactNode) => (
    <RailLink
      key={href}
      href={href}
      label={label}
      active={active === href}
      glided={Boolean(box)}
      linkRef={register(href)}
      onClick={() => setPending(href)}
    >
      {children}
    </RailLink>
  );
  return (
    <aside className="sticky top-0 hidden h-dvh shrink-0 py-4 pl-4 md:block">
      <div className="rail relative flex h-full w-[60px] flex-col items-center gap-1.5 rounded-full border border-white/10 bg-[var(--rail)] py-3 shadow-apple backdrop-blur-2xl">
        <span
          ref={blob}
          aria-hidden
          className="absolute rounded-full bg-[var(--rail-active)] shadow-[0_4px_14px_rgba(120,100,255,0.35)] transition-[top,left,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
          style={box ? { ...box, opacity: 1 } : { opacity: 0, width: 40, height: 40 }}
        />
        <Link href="/" aria-label="Personal Hub" className="mb-2 grid size-10 place-items-center">
          <LogoMark size={24} />
        </Link>
        <nav className="flex flex-col items-center gap-1.5" aria-label="Main">
          {ITEMS.map(({ href, label, icon: Icon }) => link(href, label, <Icon size={18} strokeWidth={2} />))}
        </nav>

        <span className="my-1.5 h-px w-6 bg-white/15" aria-hidden />
        <nav className="flex flex-col items-center gap-1.5" aria-label="Clients">
          {clients.map((c) =>
            link(
              `/clients/${c.id}`,
              c.name,
              <span className="grid size-7 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: c.color }}>
                {c.name.slice(0, 1).toUpperCase()}
              </span>,
            ),
          )}
          <RailLink href="/clients?new=1" label="New client" active={false} glided linkRef={() => {}} onClick={() => {}}>
            <Plus size={16} />
          </RailLink>
        </nav>

        <div className="mt-auto">{link("/settings", "Settings", <Settings size={18} />)}</div>
      </div>
    </aside>
  );
}

/** Floating glass dock (phones). */
export function TabBar() {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const items = ITEMS.filter((i) => i.href !== "/prompts");
  const active = activeOf(path, items.map((i) => i.href));
  const { register, blob, box } = useGlide(active, DOCK_SQUASH);
  return (
    <nav
      aria-label="Main"
      className="chrome fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 gap-1 rounded-full p-1.5 md:hidden"
    >
      <span
        ref={blob}
        aria-hidden
        className="absolute rounded-full bg-ink shadow-apple transition-[top,left,width,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
        style={box ? { ...box, opacity: 1 } : { opacity: 0 }}
      />
      {items.map(({ href, label, icon: Icon }) => {
        const on = active === href;
        return (
          <Link
            key={href}
            ref={register(href)}
            href={href}
            onClick={() => setPending(href)}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "relative z-[1] flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold transition-[color,transform] delay-75 duration-300 active:scale-90",
              on ? "text-on-ink" : "text-label-2",
              on && !box && "bg-ink",
            )}
          >
            <Icon size={20} strokeWidth={on ? 2.3 : 1.9} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
