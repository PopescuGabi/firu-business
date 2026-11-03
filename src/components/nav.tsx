"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LogoMark } from "./logo";
import { usePendingHref } from "./motion";
import { BookText, Briefcase, CalendarDays, Dumbbell, GraduationCap, House, Images, Mail, Settings, Sun } from "lucide-react";

// `module`: shown only when that section is turned on (lib/modules.ts); the rest are always there.
const ALL_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/today", label: "Today", icon: Sun },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/email", label: "Email", icon: Mail, module: "email" },
  { href: "/school", label: "School", icon: GraduationCap, module: "school" },
  { href: "/gym", label: "Gym", icon: Dumbbell, module: "gym" },
  { href: "/clients", label: "Clients", icon: Briefcase, module: "clients" },
  { href: "/portfolio", label: "Portfolio", icon: Images, module: "portfolio" },
  { href: "/prompts", label: "Prompts", icon: BookText, module: "prompts" },
];
const itemsFor = (modules: string[]) => ALL_ITEMS.filter((i) => !i.module || modules.includes(i.module));

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

type Sub = { href: string; label: string; dot?: string };

/**
 * A round rail button. Hovering it shows its name, or, when it has sub-pages, a small menu
 * joined to it by tree lines (like the reference's Activity / Traffic / Statistic).
 */
function RailLink({
  href,
  label,
  active,
  glided,
  linkRef,
  onClick,
  subs,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  glided: boolean; // the gliding highlight is drawn behind it, so no background of its own
  linkRef: (el: HTMLElement | null) => void;
  onClick: (href: string) => void;
  subs?: Sub[];
  children: React.ReactNode;
}) {
  return (
    <div ref={linkRef} className="group relative z-[1]">
      <Link
        href={href}
        onClick={() => onClick(href)}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] delay-75 duration-300 active:scale-90",
          active ? "text-white" : "text-[var(--rail-icon)] hover:bg-white/10 hover:text-white",
          active && !glided && "orb-btn-on",
        )}
      >
        {children}
      </Link>
      {subs?.length ? (
        <div className="pointer-events-none absolute top-0 left-full z-50 pl-3 opacity-0 transition duration-200 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="chrome min-w-44 -translate-x-1 rounded-[18px] !bg-[var(--bg-elevated)] p-2 transition duration-200 group-hover:translate-x-0">
            <p className="px-2 pt-1 pb-1.5 text-[12px] font-semibold text-label-2">{label}</p>
            <ul className="tree">
              {subs.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} onClick={() => onClick(s.href)} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[14px] text-label hover:bg-fill">
                    {s.dot && <span className="size-2 shrink-0 rounded-full" style={{ background: s.dot }} />}
                    <span className="truncate">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <span
          role="tooltip"
          className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-on-ink opacity-0 shadow-apple transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
        >
          {label}
        </span>
      )}
    </div>
  );
}

const HOME_SUBS: Sub[] = [
  { href: "/?tab=overview", label: "Overview" },
  { href: "/?tab=schedule", label: "Schedule" },
  { href: "/?tab=work", label: "Work" },
];

/** Floating pill rail (tablet and up): sections (clients in the Clients menu), settings. */
export function Sidebar({ clients, modules }: { clients: { id: number; name: string; color: string }[]; modules: string[] }) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const ITEMS = itemsFor(modules);
  const hrefs = [...ITEMS.map((i) => i.href), "/settings"];
  const active = activeOf(path, hrefs);
  const { register, blob, box } = useGlide(active, RAIL_SQUASH);
  const subsOf = (href: string): Sub[] | undefined =>
    href === "/"
      ? HOME_SUBS
      : href === "/clients"
        ? [...clients.map((c) => ({ href: `/clients/${c.id}`, label: c.name, dot: c.color })), { href: "/clients?new=1", label: "New client…" }]
        : undefined;
  const link = (href: string, label: string, children: React.ReactNode) => (
    <RailLink
      key={href}
      href={href}
      label={label}
      active={active === href}
      glided={Boolean(box)}
      linkRef={register(href)}
      onClick={(h) => setPending(h.split("?")[0] || "/")}
      subs={subsOf(href)}
    >
      {children}
    </RailLink>
  );
  return (
    <aside className="sticky top-0 z-30 hidden h-dvh shrink-0 py-4 pl-4 md:block">
      <div className="rail relative flex h-full w-[60px] flex-col items-center gap-1.5 rounded-full border border-white/10 bg-[var(--rail)] py-3 shadow-apple backdrop-blur-2xl">
        <span
          ref={blob}
          aria-hidden
          className="absolute rounded-full transition-[top,left,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
          style={{ background: "var(--orb)", boxShadow: "var(--glow)", ...(box ? { ...box, opacity: 1 } : { opacity: 0, width: 40, height: 40 }) }}
        />
        <Link href="/" aria-label="Personal Hub" className="mb-2 grid size-10 place-items-center">
          <LogoMark size={24} />
        </Link>
        <nav className="flex flex-col items-center gap-1.5" aria-label="Main">
          {ITEMS.map(({ href, label, icon: Icon }) => link(href, label, <Icon size={18} strokeWidth={2} />))}
        </nav>

        <div className="mt-auto">{link("/settings", "Settings", <Settings size={18} />)}</div>
      </div>
    </aside>
  );
}

/** Floating glass dock (phones). */
export function TabBar({ modules }: { modules: string[] }) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  // At most six on a phone: the always-on tabs plus the first chosen sections (Prompts is reached from Clients).
  const items = itemsFor(modules)
    .filter((i) => i.href !== "/prompts")
    .slice(0, 6);
  const active = activeOf(path, items.map((i) => i.href));
  const { register, blob, box } = useGlide(active, DOCK_SQUASH);
  return (
    <nav
      aria-label="Main"
      className="chrome fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 grid gap-0.5 rounded-full p-1.5 md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      <span
        ref={blob}
        aria-hidden
        className="absolute rounded-full transition-[top,left,width,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
        style={{ background: "var(--orb)", boxShadow: "var(--glow)", ...(box ? { ...box, opacity: 1 } : { opacity: 0 }) }}
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
              on ? "text-white" : "text-label-2",
              on && !box && "orb-btn-on",
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
