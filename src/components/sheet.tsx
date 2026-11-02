"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Native <dialog> sheet. Closes itself after a form inside it submits,
 * on Escape, and when the backdrop is clicked.
 */
export function Sheet({
  trigger,
  title,
  children,
  triggerClassName,
  triggerLabel,
  triggerStyle,
  defaultOpen = false,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerStyle?: React.CSSProperties;
  defaultOpen?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (defaultOpen) ref.current?.showModal();
  }, [defaultOpen]);
  return (
    <>
      <button type="button" className={triggerClassName} style={triggerStyle} aria-label={triggerLabel} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-label={title}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        onSubmit={(e) => {
          const form = e.target as HTMLFormElement;
          if (form.checkValidity()) setTimeout(() => ref.current?.close(), 0);
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
