"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { GripVertical, X } from "lucide-react";
import { setClientTabs } from "@/app/actions/client-tabs";

type Tab = { key: string; label: string };

/**
 * The client's tabs while customizing: drag a tab to move it, × hides it (its content is kept), and "Add tab"
 * (passed in as `add`) brings back hidden ones or makes new ones. Overview always stays first.
 */
export function ClientTabsInline({
  clientId,
  tabs,
  dependants,
  add,
}: {
  clientId: number;
  tabs: Tab[];
  /** Tabs that go when another one goes (Brand profile needs Content): key → keys that depend on it. */
  dependants: Record<string, string[]>;
  add: React.ReactNode;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(tabs);
  const [dragging, setDragging] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const save = (next: Tab[]) => {
    setOrder(next);
    start(async () => {
      await setClientTabs(clientId, next.map((t) => t.key));
      router.refresh();
    });
  };
  const moveTo = (key: string, over: string) => {
    if (key === over || over === "overview") return;
    const from = order.findIndex((t) => t.key === key);
    const to = order.findIndex((t) => t.key === over);
    if (from <= 0 || to <= 0) return;
    const next = [...order];
    const [t] = next.splice(from, 1);
    next.splice(to, 0, t);
    setOrder(next);
  };
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", busy && "opacity-80")} aria-label="Tabs (drag to reorder)">
      {order.map((t) => {
        const fixed = t.key === "overview";
        return (
          <span
            key={t.key}
            draggable={!fixed}
            onDragStart={(e) => {
              setDragging(t.key);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              moveTo(dragging, t.key);
            }}
            onDragEnd={() => {
              setDragging(null);
              save(order);
            }}
            className={clsx(
              "glass inline-flex h-8 items-center gap-1 rounded-full pr-1.5 pl-1.5 text-[13px] font-semibold select-none",
              fixed ? "pl-3.5 pr-3.5" : "cursor-grab active:cursor-grabbing",
              dragging === t.key && "opacity-50",
            )}
          >
            {!fixed && <GripVertical size={14} className="text-label-3" />}
            {t.label}
            {!fixed && (
              <button
                type="button"
                aria-label={`Hide ${t.label}`}
                onClick={() => save(order.filter((x) => x.key !== t.key && !(dependants[t.key] ?? []).includes(x.key)))}
                className="ml-0.5 grid size-6 cursor-pointer place-items-center rounded-full text-label-3 hover:bg-fill hover:text-label"
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            )}
          </span>
        );
      })}
      {add}
    </div>
  );
}
