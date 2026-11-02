"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LogoMark } from "./logo";
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

export function Sidebar({ clients }: { clients: { id: number; name: string; color: string }[] }) {
  const path = usePathname();
  return (
    <aside className="material sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-separator px-3 pt-6 pb-4 md:flex">
      <div className="mb-5 flex items-center gap-2 px-3">
        <LogoMark size={22} />
        <span className="text-[15px] font-semibold tracking-tight">Personal Hub</span>
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={clsx(
              "flex h-8 items-center gap-2.5 rounded-lg px-3 text-[14px] font-medium transition",
              isActive(path, href) ? "bg-blue text-white" : "text-label hover:bg-fill",
            )}
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 mb-1.5 flex items-center justify-between px-3">
        <span className="text-[12px] font-semibold text-label-2 uppercase">Clients</span>
        <Link href="/clients?new=1" aria-label="New client" className="rounded-md p-0.5 text-label-2 hover:bg-fill hover:text-label">
          <Plus size={15} />
        </Link>
      </div>
      <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto" aria-label="Clients">
        {clients.map((c) => {
          const href = `/clients/${c.id}`;
          const active = path.startsWith(href);
          return (
            <Link
              key={c.id}
              href={href}
              className={clsx(
                "flex h-8 items-center gap-2.5 rounded-lg px-3 text-[14px] transition",
                active ? "bg-fill-2 font-semibold" : "hover:bg-fill",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/settings"
        aria-current={path.startsWith("/settings") ? "page" : undefined}
        className={clsx(
          "mt-auto flex h-8 items-center gap-2.5 rounded-lg px-3 text-[14px] font-medium",
          path.startsWith("/settings") ? "bg-blue text-white" : "hover:bg-fill",
        )}
      >
        <Settings size={17} />
        Settings
      </Link>
    </aside>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="material pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-separator md:hidden"
    >
      {ITEMS.filter((i) => i.href !== "/prompts").map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(path, href) ? "page" : undefined}
          className={clsx(
            "flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium",
            isActive(path, href) ? "text-blue" : "text-label-2",
          )}
        >
          <Icon size={23} strokeWidth={isActive(path, href) ? 2.3 : 1.8} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
