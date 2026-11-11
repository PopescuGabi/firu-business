"use client";
// Liquid Glass components. Each one is a GlassSurface plus behaviour; none touches the shader logic.
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { springCurve } from "@/lib/glass/spring";
import type { GlassMode } from "@/lib/glass/theme";
import { GlassSurface, useGlass, type GlassSurfaceProps } from "./engine";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- GlassButton ---------- */

export type GlassButtonProps = Omit<ComponentProps<"button">, "children"> & {
  variant?: "primary" | "secondary";
  shape?: "capsule" | "rounded" | "circle";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
  mode?: GlassMode;
  children?: ReactNode;
};

export function GlassButton({ variant = "secondary", shape = "capsule", size = "md", icon, loading = false, mode, disabled, className, children, ...rest }: GlassButtonProps) {
  const iconOnly = !children;
  return (
    <GlassSurface
      as="button"
      type="button"
      {...rest}
      mode={mode}
      shape={iconOnly && shape === "capsule" ? "circle" : shape === "rounded" ? "rounded" : shape}
      radius={14}
      tint={variant === "primary" ? "accent" : "clear"}
      interactive={!disabled && !loading}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx("lg-btn", `lg-btn-${size}`, iconOnly && "lg-btn-icon", className)}
    >
      {loading ? <span className="lg-spin" aria-hidden /> : icon}
      {children != null && <span className="lg-btn-label">{children}</span>}
    </GlassSurface>
  );
}

/* ---------- GlassCard and GlassContainer ---------- */

export function GlassCard<T extends React.ElementType = "section">({ className, radius = 26, ...props }: GlassSurfaceProps<T>) {
  const p = { as: "section", ...props } as GlassSurfaceProps<T>;
  return <GlassSurface {...p} radius={radius} className={clsx("lg-card", className)} />;
}

/** Wraps any content in a glass surface. */
export function GlassContainer<T extends React.ElementType = "div">({ radius = 20, ...props }: GlassSurfaceProps<T>) {
  return <GlassSurface {...(props as GlassSurfaceProps<T>)} radius={radius} />;
}

/* ---------- GlassInput ---------- */

export type GlassInputProps = Omit<ComponentProps<"input">, "size"> & {
  label: string;
  icon?: ReactNode;
  hint?: string;
  error?: string;
  /** Starts as a round button-sized field and grows into a full search field when focused. */
  expandable?: boolean;
  mode?: GlassMode;
  trailing?: ReactNode;
};

export function GlassInput({ label, icon, hint, error, expandable = false, mode, trailing, id, className, onFocus, onBlur, ...input }: GlassInputProps) {
  const auto = useId();
  const iid = id ?? auto;
  const msgId = `${iid}-msg`;
  const [open, setOpen] = useState(!expandable);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={clsx("lg-field", className)}>
      <GlassSurface
        shape="capsule"
        mode={mode}
        className="lg-input"
        data-open={open ? "" : undefined}
        data-invalid={error ? "" : undefined}
        onClick={() => ref.current?.focus()}
      >
        {icon && <span className="lg-input-icon" aria-hidden>{icon}</span>}
        <label htmlFor={iid} className="sr-only">{label}</label>
        <input
          ref={ref}
          id={iid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          {...input}
          onFocus={(e) => {
            setOpen(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            if (expandable && !e.currentTarget.value) setOpen(false);
            onBlur?.(e);
          }}
        />
        {trailing}
      </GlassSurface>
      {(error || hint) && (
        <p id={msgId} className={clsx("lg-msg", error && "lg-msg-error")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/* ---------- GlassNavbar ---------- */

export type GlassNavItem = { href: string; label: string; icon?: ReactNode };

function activeOf(items: GlassNavItem[], path: string) {
  let best = "";
  for (const it of items) {
    if (it.href === "/" ? path === "/" : path === it.href || path.startsWith(it.href + "/")) {
      if (it.href.length > best.length) best = it.href;
    }
  }
  return best;
}

export function GlassNavbar({
  items,
  activeHref,
  orientation = "horizontal",
  label = "Main",
  header,
  footer,
  mode,
  className,
  onSelect,
}: {
  items: GlassNavItem[];
  activeHref?: string;
  /** Handle selection yourself (tabs inside a page) instead of navigating. */
  onSelect?: (href: string) => void;
  orientation?: "horizontal" | "vertical";
  label?: string;
  header?: ReactNode;
  footer?: ReactNode;
  mode?: GlassMode;
  className?: string;
}) {
  const path = usePathname();
  const active = activeHref ?? activeOf(items, path);
  const list = useRef<HTMLUListElement>(null);
  const [ind, setInd] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const measure = () => {
      const a = ul.querySelector<HTMLElement>('[aria-current="page"]');
      setInd(a ? { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [active, orientation]);

  return (
    <GlassSurface as="nav" aria-label={label} mode={mode} shape={orientation === "horizontal" ? "capsule" : "rounded"} radius={26} className={clsx("lg-nav", `lg-nav-${orientation}`, className)}>
      {header}
      <ul ref={list}>
        {ind && <li role="presentation" className="lg-nav-ind" style={{ transform: `translate(${ind.x}px, ${ind.y}px)`, width: ind.w, height: ind.h }} />}
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active === it.href ? "page" : undefined}
              className="lg-nav-link"
              onClick={(e) => {
                if (!onSelect) return;
                e.preventDefault();
                onSelect(it.href);
              }}
            >
              {it.icon && <span aria-hidden className="lg-nav-icon">{it.icon}</span>}
              <span className="lg-nav-label">{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {footer}
    </GlassSurface>
  );
}

/* ---------- GlassDock ---------- */

export type GlassDockAction = { id: string; label: string; icon: ReactNode; onSelect?: () => void; active?: boolean; className?: string };

export function GlassDock({ actions, more, label = "Toolbar", mode, className, children }: { actions: GlassDockAction[]; more?: GlassDockAction[]; label?: string; mode?: GlassMode; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  // Roving focus with the arrow keys, as a toolbar should have.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    const btns = Array.from(bar.current?.querySelectorAll<HTMLButtonElement>("button:not([tabindex='-1'])") ?? []).filter((b) => b.offsetParent !== null);
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[next]?.focus();
    e.preventDefault();
  };
  const button = (a: GlassDockAction, hidden = false) => (
    <button key={a.id} type="button" className={clsx("lg-dock-btn", a.className)} aria-label={a.label} title={a.label} aria-pressed={a.active ?? undefined} tabIndex={hidden ? -1 : undefined} onClick={a.onSelect}>
      {a.icon}
    </button>
  );
  return (
    <GlassSurface ref={bar} role="toolbar" aria-label={label} aria-orientation="horizontal" shape="capsule" mode={mode} className={clsx("lg-dock", className)} data-open={open ? "" : undefined} onKeyDown={onKey}>
      {actions.map((a) => button(a))}
      {children}
      {more?.length ? (
        <>
          <div className="lg-dock-more" aria-hidden={!open}>
            <div>{more.map((a) => button(a, !open))}</div>
          </div>
          <button type="button" className="lg-dock-btn lg-dock-toggle" aria-expanded={open} aria-label={open ? "Fewer actions" : "More actions"} onClick={() => setOpen((o) => !o)}>
            <Plus size={20} aria-hidden />
          </button>
        </>
      ) : null}
    </GlassSurface>
  );
}

/* ---------- GlassModal ---------- */

export function GlassModal({
  open,
  onClose,
  title,
  originRef,
  mode,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The element the panel grows out of and shrinks back into. */
  originRef?: RefObject<HTMLElement | null>;
  mode?: GlassMode;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const { theme } = useGlass();

  const morph = useCallback(
    (direction: "in" | "out") => {
      const p = panel.current;
      if (!p) return Promise.resolve();
      const spring = springCurve(theme.motion.springStiffness, theme.motion.springDamping, theme.motion.morphDuration * 2.5);
      const from = originRef?.current?.getBoundingClientRect();
      const to = p.getBoundingClientRect();
      let start: Keyframe = { opacity: 0, transform: "scale(0.96)" };
      if (from && from.width && !reducedMotion()) {
        const dx = from.left + from.width / 2 - (to.left + to.width / 2);
        const dy = from.top + from.height / 2 - (to.top + to.height / 2);
        start = { opacity: 0.5, transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: "999px" };
      }
      const end: Keyframe = { opacity: 1, transform: "none", borderRadius: "28px" };
      const anim = p.animate(direction === "in" ? [start, end] : [end, start], {
        duration: reducedMotion() ? 120 : direction === "in" ? spring.duration : 220,
        easing: direction === "in" && !reducedMotion() ? spring.easing : "cubic-bezier(0.4, 0, 1, 1)",
        fill: "both",
      });
      return anim.finished.then(() => anim.cancel());
    },
    [originRef, theme],
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
      morph("in");
    } else if (!open && d.open) {
      morph("out").then(() => {
        d.close();
        opener.current?.focus();
      });
    }
  }, [open, morph]);

  return (
    <dialog
      ref={dialog}
      className="lg-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // Escape: let the parent close it, so the shrink animation plays
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GlassSurface ref={panel} mode={mode} radius={28} contrast="high" className={clsx("lg-modal-panel", className)}>
        <header className="lg-modal-head">
          <h2 id={titleId}>{title}</h2>
          <GlassButton size="sm" aria-label="Close" icon={<X size={16} aria-hidden />} onClick={onClose} />
        </header>
        <div className="lg-modal-body">{children}</div>
      </GlassSurface>
    </dialog>
  );
}

/* ---------- GlassDropdown ---------- */

export type GlassMenuItem = { id: string; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean };

export function GlassDropdown({ label, items, icon, mode, align = "start" }: { label: string; items: GlassMenuItem[]; icon?: ReactNode; mode?: GlassMode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<"below" | "above">("below");
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const show = (index: number) => {
    const r = trigger.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom;
      setPlace(below < 40 + items.length * 44 && r.top > below ? "above" : "below");
    }
    setActive(index);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const last = items.length - 1;
    if (e.key === "ArrowDown") setActive((a) => (a >= last ? 0 : a + 1));
    else if (e.key === "ArrowUp") setActive((a) => (a <= 0 ? last : a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") close(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  };

  return (
    <div className="lg-dd" data-align={align}>
      <GlassButton
        ref={trigger}
        icon={icon}
        mode={mode}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : show(0))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            show(0);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            show(items.length - 1);
          }
        }}
      >
        {label}
      </GlassButton>
      {open && (
        <GlassSurface ref={menu} id={menuId} role="menu" aria-label={label} mode={mode} radius={18} contrast="high" className="lg-dd-menu" data-place={place} onKeyDown={onMenuKey}>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              className="lg-dd-item"
              data-danger={it.danger ? "" : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.icon && <span aria-hidden className="lg-dd-icon">{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </GlassSurface>
      )}
    </div>
  );
}
