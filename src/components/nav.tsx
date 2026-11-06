"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { iconFor } from "./custom/icons";
import { LogoMark } from "./logo";
import { usePendingHref } from "./motion";
import { BarChart3, Briefcase, CalendarDays, House, Images, LayoutGrid, Mail, Settings, Sun } from "lucide-react";

// `module`: shown only when that section is turned on (lib/modules.ts); the rest are always there.
const ALL_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/today", label: "Today", icon: Sun },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/email", label: "Email", icon: Mail, module: "email" },
  { href: "/clients", label: "Clients", icon: Briefcase, module: "clients" },
  { href: "/instagram", label: "Instagram", icon: BarChart3, module: "instagram" },
  { href: "/portfolio", label: "Portfolio", icon: Images, module: "portfolio" },
];
/** A person's own pages (custom pages), shown after the built-in sections. */
export type NavPage = { slug: string; title: string; icon: string };
/** Dashboards other businesses share with this person ("From Gabi"). */
export type NavShared = { href: string; label: string };
const itemsFor = (modules: string[], pages: NavPage[] = [], shared: NavShared[] = []) => [
  ...ALL_ITEMS.filter((i) => !i.module || modules.includes(i.module)),
  ...pages.map((p) => ({ href: `/p/${p.slug}`, label: p.title, icon: iconFor(p.icon) })),
  ...shared.map((x) => ({ href: x.href, label: x.label, icon: iconFor("users") })),
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
export function Sidebar({ clients, modules, pages = [], shared = [] }: { clients: { id: number; name: string; color: string }[]; modules: string[]; pages?: NavPage[]; shared?: NavShared[] }) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const ITEMS = itemsFor(modules, pages, shared);
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
        <Link href="/" aria-label="FIRU Business" className="mb-2 grid size-10 place-items-center">
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

// On a phone the dock keeps the everyday pages; everything else is in More.
const DOCK = ["/", "/today", "/calendar", "/email"];

/** Floating glass dock (phones): Home, Today, Calendar, Email, and More for the rest. */
export function TabBar({ modules, clients, pages = [], shared = [] }: { modules: string[]; clients: { id: number; name: string; color: string }[]; pages?: NavPage[]; shared?: NavShared[] }) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const [open, setOpen] = useState(false);
  const all = itemsFor(modules, pages, shared);
  const items = all.filter((i) => DOCK.includes(i.href));
  const more = [...all.filter((i) => !DOCK.includes(i.href)), { href: "/settings", label: "Settings", icon: Settings }];
  const inMore = more.some((i) => isActive(path, i.href));
  const active = activeOf(path, items.map((i) => i.href)) ?? (inMore ? "more" : null);
  const { register, blob, box } = useGlide(open ? "more" : active, DOCK_SQUASH);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const go = (href: string) => {
    setPending(href.split("?")[0] || "/");
    setOpen(false);
  };
  const tab = "relative z-[1] flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold transition-[color,transform] delay-75 duration-300 active:scale-90";
  return (
    <>
      {open && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default bg-black/10 md:hidden" onClick={() => setOpen(false)} />
          <div
            id="more-menu"
            className="more-sheet chrome fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] z-40 max-h-[60dvh] overflow-y-auto rounded-[26px] !bg-[var(--bg-elevated)] p-2 md:hidden"
          >
            <ul className="flex flex-col">
              {more.map(({ href, label, icon: Icon }) => {
                const on = isActive(path, href);
                return (
                  <li key={href}>
                    <Link href={href} onClick={() => go(href)} aria-current={on ? "page" : undefined} className="flex items-center gap-3 rounded-[16px] px-2.5 py-2 text-[16px] font-medium hover:bg-fill">
                      <span className={clsx("grid size-9 shrink-0 place-items-center rounded-full", on ? "orb-btn-on" : "bg-fill text-label-2")}>
                        <Icon size={18} />
                      </span>
                      {label}
                    </Link>
                    {href === "/clients" && clients.length > 0 && (
                      <ul className="tree mb-1 ml-[30px]">
                        {clients.map((c) => (
                          <li key={c.id}>
                            <Link href={`/clients/${c.id}`} onClick={() => go(`/clients/${c.id}`)} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] hover:bg-fill">
                              <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
                              <span className="truncate">{c.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      <nav
        aria-label="Main"
        className="chrome fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 grid gap-0.5 rounded-full p-1.5 md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        <span
          ref={blob}
          aria-hidden
          className="absolute rounded-full transition-[top,left,width,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
          style={{ background: "var(--orb)", boxShadow: "var(--glow)", ...(box ? { ...box, opacity: 1 } : { opacity: 0 }) }}
        />
        {items.map(({ href, label, icon: Icon }) => {
          const on = !open && active === href;
          return (
            <Link
              key={href}
              ref={register(href)}
              href={href}
              onClick={() => go(href)}
              aria-current={on ? "page" : undefined}
              className={clsx(tab, on ? "text-white" : "text-label-2", on && !box && "orb-btn-on")}
            >
              <Icon size={20} strokeWidth={on ? 2.3 : 1.9} />
              {label}
            </Link>
          );
        })}
        <button
          ref={register("more")}
          type="button"
          aria-expanded={open}
          aria-controls="more-menu"
          onClick={() => setOpen((o) => !o)}
          className={clsx(tab, "cursor-pointer", open || active === "more" ? "text-white" : "text-label-2", (open || active === "more") && !box && "orb-btn-on")}
        >
          <LayoutGrid size={20} strokeWidth={open || active === "more" ? 2.3 : 1.9} />
          More
        </button>
      </nav>
    </>
  );
}
