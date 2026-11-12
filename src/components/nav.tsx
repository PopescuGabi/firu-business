"use client";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { iconFor } from "./custom/icons";
import { LogoMark } from "./logo";
import { usePendingHref } from "./motion";
import { BarChart3, Briefcase, CalendarDays, ChartNoAxesCombined, CornerDownLeft, Globe, House, LayoutGrid, Mail, Search, Settings, Sun } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { GlassSurface } from "./glass/engine";

// `module`: shown only when that section is turned on (lib/modules.ts); the rest are always there.
// The four Dashboard tabs come first; the older sections follow under "More" (nothing was removed).
const ALL_ITEMS = [
  { href: "/", label: "Home", icon: House },
  { href: "/analysis", label: "Analysis", icon: ChartNoAxesCombined },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/portfolio", label: "Portfolio", icon: Globe, module: "portfolio" },
  { href: "/today", label: "Today", icon: Sun },
  { href: "/email", label: "Email", icon: Mail, module: "email" },
  { href: "/clients", label: "Clients", icon: Briefcase, module: "clients" },
  { href: "/instagram", label: "Instagram", icon: BarChart3, module: "instagram" },
];
const TABS = ["/", "/analysis", "/calendar", "/portfolio"];
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

const RAIL_SQUASH: [number, number] = [0.97, 1.08];
const DOCK_SQUASH: [number, number] = [1.12, 0.86];

/** The signed-in person, shown at the bottom of the menu. */
export type NavMe = { name: string; picture?: string | null };

/**
 * One row of the side menu: icon and name on a computer, the icon alone (name on hover) on a tablet.
 * The gliding glass highlight is drawn behind the active row, so the row itself has no background then.
 */
function RailLink({
  href,
  label,
  active,
  glided,
  linkRef,
  onClick,
  sub,
  dot,
  extra,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  glided: boolean;
  linkRef: (el: HTMLElement | null) => void;
  onClick: (href: string) => void;
  sub?: boolean;
  dot?: string;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div ref={linkRef} className={clsx("group relative z-[1]", sub && "max-lg:hidden")}>
      <Link
        href={href}
        onClick={() => onClick(href)}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "flex items-center rounded-[12px] font-medium transition-[background-color,color] duration-200 active:scale-[0.98]",
          sub ? "h-8 gap-2.5 pr-2 pl-9 text-[13px]" : "h-10 gap-3 px-3 text-[14px] max-lg:mx-auto max-lg:size-10 max-lg:justify-center max-lg:px-0",
          active ? "text-label" : "text-label-2 hover:bg-fill hover:text-label",
          active && !glided && "sel-pane",
        )}
      >
        {dot ? <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} /> : children}
        <span className={clsx("min-w-0 flex-1 truncate", !sub && "max-lg:hidden")}>{label}</span>
        {extra && <span className="max-lg:hidden">{extra}</span>}
      </Link>
      {!sub && (
        <span
          role="tooltip"
          className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-on-ink opacity-0 shadow-apple transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 lg:hidden"
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * The side menu (tablet and up): a glass panel with the sections (your clients under Clients), your own pages,
 * search (⌘K) and your account. On a tablet it narrows to icons.
 */
export function Sidebar({
  clients,
  modules,
  pages = [],
  shared = [],
  me,
}: {
  clients: { id: number; name: string; color: string }[];
  modules: string[];
  pages?: NavPage[];
  shared?: NavShared[];
  me: NavMe;
}) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const all = itemsFor(modules, pages, shared);
  const main = ALL_ITEMS.filter((i) => !i.module || modules.includes(i.module));
  const own = all.slice(main.length);
  const clientLinks = modules.includes("clients") ? clients.slice(0, 8).map((c) => ({ href: `/clients/${c.id}`, label: c.name, dot: c.color })) : [];
  const hrefs = [...all.map((i) => i.href), ...clientLinks.map((c) => c.href), "/settings"];
  const active = activeOf(path, hrefs);
  const { register, blob, box } = useGlide(active, RAIL_SQUASH);
  const go = (h: string) => setPending(h.split("?")[0] || "/");
  const link = (href: string, label: string, icon?: React.ReactNode, opts: { sub?: boolean; dot?: string; extra?: React.ReactNode } = {}) => (
    <RailLink key={href} href={href} label={label} active={active === href} glided={Boolean(box)} linkRef={register(href)} onClick={go} {...opts}>
      {icon}
    </RailLink>
  );
  const initial = (me.name.trim()[0] ?? "?").toUpperCase();
  return (
    <aside className="sticky top-0 z-30 hidden h-dvh shrink-0 py-3 pl-3 md:block">
      <GlassSurface as="div" radius={26} contrast="high" className="rail relative flex h-full w-[64px] flex-col gap-1 overflow-y-auto px-2 py-3 scrollbar-none lg:w-[236px]">
        <span
          ref={blob}
          aria-hidden
          className="sel-pane absolute rounded-[12px] transition-[top,left,width,height,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
          style={box ? { ...box, opacity: 1 } : { opacity: 0, width: 40, height: 40 }}
        />
        <Link href="/" aria-label={APP_NAME} className="mb-1 flex h-10 items-center gap-2.5 px-2.5 max-lg:justify-center max-lg:px-0">
          <LogoMark size={26} />
          <span className="text-[15px] font-semibold tracking-[-0.01em] max-lg:hidden">{APP_NAME}</span>
        </Link>
        <CommandMenu items={[...all, ...clients.map((c) => ({ href: `/clients/${c.id}`, label: c.name, icon: Briefcase })), { href: "/settings", label: "Settings", icon: Settings }]} onGo={go} />
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {main.map(({ href, label, icon: Icon }, k) => (
            <Fragment key={href}>
              {k > 0 && !TABS.includes(href) && TABS.includes(main[k - 1].href) && (
                <p className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-[0.04em] text-label-3 uppercase max-lg:hidden">More</p>
              )}
              {link(href, label, <Icon size={18} strokeWidth={1.9} />)}
              {href === "/clients" && clientLinks.map((c) => link(c.href, c.label, undefined, { sub: true, dot: c.dot }))}
            </Fragment>
          ))}
          {own.length > 0 && <p className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-[0.04em] text-label-3 uppercase max-lg:hidden">Your pages</p>}
          {own.map(({ href, label, icon: Icon }) => link(href, label, <Icon size={18} strokeWidth={1.9} />))}
        </nav>
        <div className="mt-auto pt-2">
          <div ref={register("/settings")} className="relative z-[1]">
            <Link
              href="/settings"
              onClick={() => go("/settings")}
              aria-label="Settings and account"
              aria-current={active === "/settings" ? "page" : undefined}
              className={clsx(
                "flex items-center gap-2.5 rounded-[16px] p-2 transition hover:bg-fill max-lg:mx-auto max-lg:size-11 max-lg:justify-center max-lg:p-0",
                active === "/settings" && !box && "sel-pane",
              )}
            >
              {me.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.picture} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-[10px] object-cover" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-[13px] font-semibold text-accent">{initial}</span>
              )}
              <span className="min-w-0 flex-1 max-lg:hidden">
                <span className="block truncate text-[13px] font-semibold">{me.name}</span>
                <span className="block truncate text-[12px] text-label-2">Settings and account</span>
              </span>
              <Settings size={16} className="shrink-0 text-label-3 max-lg:hidden" />
            </Link>
          </div>
        </div>
      </GlassSurface>
    </aside>
  );
}

type JumpItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };

/** "Search or jump to" (⌘K): type part of a page or client name and press Enter. */
function CommandMenu({ items, onGo }: { items: JumpItem[]; onGo: (href: string) => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const found = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 9);
  const open = () => {
    setQ("");
    setSel(0);
    dialog.current?.showModal();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (href: string) => {
    dialog.current?.close();
    onGo(href);
    router.push(href);
  };
  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Search or jump to"
        className="mb-2 flex h-9 items-center gap-2 rounded-full px-3 text-[13px] text-label-3 transition hover:text-label-2 max-lg:mx-auto max-lg:size-10 max-lg:justify-center max-lg:px-0"
        style={{ background: "var(--field-bg)", boxShadow: "var(--field-edge)" }}
      >
        <Search size={15} className="shrink-0" />
        <span className="flex-1 text-left max-lg:hidden">Search or jump to</span>
        <kbd className="rounded-[5px] px-1 font-sans text-[11px] shadow-[inset_0_0_0_1px_var(--separator)] max-lg:hidden">⌘K</kbd>
      </button>
      <dialog ref={dialog} className="sheet !w-[min(520px,calc(100vw-24px))] p-2" aria-label="Search or jump to" onClose={() => setQ("")}>
        <div className="flex items-center gap-2 px-3 pt-1 pb-2">
          <Search size={17} className="text-label-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setSel((s) => Math.min(s + 1, found.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
              if (e.key === "Enter" && found[sel]) (e.preventDefault(), go(found[sel].href));
            }}
            placeholder="Search pages and clients"
            aria-label="Search pages and clients"
            className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-label-3 focus-visible:outline-none"
          />
          <kbd className="rounded-[5px] px-1.5 text-[11px] text-label-3 shadow-[inset_0_0_0_1px_var(--separator)]">esc</kbd>
        </div>
        <ul className="border-t border-separator pt-1">
          {found.length === 0 && <li className="px-3 py-3 text-[14px] text-label-2">Nothing matches “{q}”.</li>}
          {found.map((i, k) => (
            <li key={i.href}>
              <button
                type="button"
                onMouseEnter={() => setSel(k)}
                onClick={() => go(i.href)}
                className={clsx("flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[15px]", k === sel ? "sel-pane" : "text-label-2")}
              >
                <i.icon size={17} />
                <span className="flex-1 truncate text-label">{i.label}</span>
                {k === sel && <CornerDownLeft size={14} className="text-label-3" />}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}

// On a phone the dock keeps the everyday pages; everything else is in More.
const DOCK = TABS;

/** Floating glass dock (phones): Home, Today, Calendar, Email, and More for the rest. */
export function TabBar({ modules, clients, pages = [], shared = [] }: { modules: string[]; clients: { id: number; name: string; color: string }[]; pages?: NavPage[]; shared?: NavShared[] }) {
  const { path: current, pending, setPending } = usePendingHref();
  const path = pending ?? current;
  const [open, setOpen] = useState(false);
  const all = itemsFor(modules, pages, shared);
  const items = all.filter((i) => DOCK.includes(i.href));
  // Settings comes first so it is never out of reach on a phone.
  const more = [{ href: "/settings", label: "Settings", icon: Settings }, ...all.filter((i) => !DOCK.includes(i.href))];
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
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-[45] cursor-default bg-black/25 md:hidden" onClick={() => setOpen(false)} />
          <div
            id="more-menu"
            className="more-sheet chrome fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] z-50 max-h-[60dvh] overflow-y-auto rounded-[26px] !bg-[var(--bg-elevated)] p-2 md:hidden"
          >
            <ul className="flex flex-col">
              {more.map(({ href, label, icon: Icon }) => {
                const on = isActive(path, href);
                return (
                  <li key={href}>
                    <Link href={href} onClick={() => go(href)} aria-current={on ? "page" : undefined} className="flex items-center gap-3 rounded-[16px] px-2.5 py-2 text-[16px] font-medium hover:bg-fill">
                      <span className={clsx("grid size-9 shrink-0 place-items-center rounded-full", on ? "sel-pane text-accent" : "bg-fill text-label-2")}>
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
        className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 md:hidden"
      >
        {/* The phone dock: lens glass on every device (lens="always"). */}
        <GlassSurface as="div" shape="capsule" contrast="high" lens="always" className="grid gap-0.5 p-1.5" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        <span
          ref={blob}
          aria-hidden
          className="sel-pane absolute rounded-full transition-[top,left,width,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]"
          style={box ? { ...box, opacity: 1 } : { opacity: 0 }}
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
              className={clsx(tab, on ? "text-accent" : "text-label-2", on && !box && "sel-pane")}
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
          className={clsx(tab, "cursor-pointer", open || active === "more" ? "text-accent" : "text-label-2", (open || active === "more") && !box && "sel-pane")}
        >
          <LayoutGrid size={20} strokeWidth={open || active === "more" ? 2.3 : 1.9} />
          More
        </button>
      </GlassSurface>
      </nav>
    </>
  );
}
