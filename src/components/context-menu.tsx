"use client";
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export type MenuItem = {
  label: string;
  destructive?: boolean;
  /** Asked before running, for things that are hard to undo (e.g. a whole repeating series). */
  confirm?: string;
  /** A server action (bound to its ids) or a local handler. A returned { ok: false, message } is shown. */
  action: () => unknown;
};

/** Right-click (or long-press) menu. Spread `onContextMenu` on the element and render `menu` next to it. */
export function useContextMenu(items: MenuItem[]) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!at || !ref.current) return setPos(null);
    // Keep the menu on screen near the pointer.
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(at.x, window.innerWidth - width - 8)),
      top: Math.max(8, at.y + height > window.innerHeight - 8 ? at.y - height : at.y),
    });
  }, [at]);

  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    ref.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [at]);

  const run = (item: MenuItem) => {
    setAt(null);
    if (item.confirm && !confirm(item.confirm)) return;
    start(async () => {
      const res = (await item.action()) as { ok?: boolean; message?: string } | undefined;
      if (res && res.ok === false) alert(res.message ?? "That didn't work");
    });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!items.length) return;
    e.preventDefault();
    e.stopPropagation();
    setAt({ x: e.clientX, y: e.clientY });
  };

  const menu =
    at &&
    createPortal(
      <div
        ref={ref}
        role="menu"
        className="ctx-menu fixed z-50 min-w-[200px] rounded-[18px] border border-[var(--glass-border)] p-1.5 text-[14px]"
        style={pos ?? { left: at.x, top: at.y, visibility: "hidden" }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          const buttons = [...(ref.current?.querySelectorAll("button") ?? [])];
          const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => run(item)}
            className={clsx(
              "block w-full cursor-pointer rounded-xl px-3 py-1.5 text-left outline-none hover:bg-ink hover:text-on-ink focus-visible:bg-ink focus-visible:text-on-ink",
              item.destructive && "text-red",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>,
      document.body,
    );

  return { onContextMenu, menu, pending };
}

/** Wraps children so right-clicking anywhere inside opens the menu. */
export function ContextMenu({ items, children, className, style }: { items: MenuItem[]; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const { onContextMenu, menu, pending } = useContextMenu(items);
  return (
    <div onContextMenu={onContextMenu} style={style} className={clsx(className, pending && "pointer-events-none opacity-40 transition-opacity")}>
      {children}
      {menu}
    </div>
  );
}
