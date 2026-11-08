"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { useContextMenu, type MenuItem } from "./context-menu";

/**
 * Native <dialog> sheet. Closes itself after a form inside it submits (unless marked data-keep-open),
 * on Escape, and when the backdrop is clicked. With `menu`, right-clicking the trigger offers
 * those actions (plus opening the sheet).
 */
export function Sheet({
  trigger,
  title,
  children,
  triggerClassName,
  triggerLabel,
  triggerStyle,
  defaultOpen = false,
  menu,
  openLabel = "Open",
  openId,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerStyle?: React.CSSProperties;
  defaultOpen?: boolean;
  menu?: MenuItem[];
  openLabel?: string;
  /** Lets a menu elsewhere open this sheet: dispatch `new CustomEvent("open-sheet", { detail: openId })`. */
  openId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ctx = useContextMenu(menu?.length ? [{ label: openLabel, action: () => ref.current?.showModal() }, ...menu] : []);
  useEffect(() => {
    if (defaultOpen) ref.current?.showModal();
  }, [defaultOpen]);
  useEffect(() => {
    if (!openId) return;
    const open = (e: Event) => (e as CustomEvent<string>).detail === openId && ref.current?.showModal();
    window.addEventListener("open-sheet", open);
    return () => window.removeEventListener("open-sheet", open);
  }, [openId]);
  return (
    <>
      <button
        type="button"
        className={clsx(triggerClassName, ctx.pending && "pointer-events-none opacity-40 transition-opacity")}
        style={triggerStyle}
        aria-label={triggerLabel}
        onClick={() => ref.current?.showModal()}
        onContextMenu={ctx.onContextMenu}
      >
        {trigger}
      </button>
      {ctx.menu}
      <dialog
        ref={ref}
        className="sheet"
        aria-label={title}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        onSubmit={(e) => {
          const form = e.target as HTMLFormElement;
          // Forms marked data-keep-open close the sheet themselves once the server says it worked.
          if (form.checkValidity() && !form.hasAttribute("data-keep-open")) setTimeout(() => ref.current?.close(), 0);
        }}
      >
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between border-b border-separator px-5 py-3.5">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              className="grid size-7 cursor-pointer place-items-center rounded-full bg-fill text-label-2 hover:bg-fill-2"
              onClick={() => ref.current?.close()}
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
