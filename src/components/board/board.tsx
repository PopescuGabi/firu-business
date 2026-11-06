"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, LayoutGrid, Plus, RotateCcw, X } from "lucide-react";
import { addWidget, BREAKPOINTS, removeWidget, type BoardLayout, type Breakpoint, type WidgetDef } from "@/lib/board";
import { buttonClass } from "../ui";
import { libraryDrag } from "./drag-state";

/** One widget someone can put on a board: what the library shows, and its sizes. */
export type BoardWidget = { def: WidgetDef; title: string; hint?: string; group?: string; icon: React.ReactNode };

const Editor = dynamic(() => import("./board-editor"), { ssr: false });

const VAR = { computer: "c", tablet: "t", phone: "p" } as const;

/** Where a widget sits in each layout, as CSS variables the board grid reads (see .board-grid in globals.css). */
export function cellStyle(layout: BoardLayout, id: string, index: number): React.CSSProperties {
  const vars: Record<string, number> = { "--i": index };
  for (const bp of BREAKPOINTS) {
    const it = layout[bp].find((x) => x.i === id);
    if (!it) continue;
    const v = VAR[bp];
    vars[`--${v}x`] = it.x + 1;
    vars[`--${v}y`] = it.y + 1;
    vars[`--${v}w`] = it.w;
    vars[`--${v}h`] = it.h;
  }
  return vars as React.CSSProperties;
}

/**
 * A board people arrange themselves. Outside edit mode it's a plain CSS grid (rendered on the server, nothing to
 * load); "Customize" swaps in the drag-and-resize editor at exactly the same positions.
 */
export function Board({
  widgets,
  catalogue,
  layout: saved,
  save,
  reset,
  resetLabel = "Reset",
  header,
  notice,
  emptyText = "Nothing on this board yet.",
}: {
  /** The rendered widgets on the board (rendered on the server; a newly added one appears after a refresh). */
  widgets: Record<string, React.ReactNode>;
  /** Every widget this person may put on this board. */
  catalogue: BoardWidget[];
  layout: BoardLayout;
  save: (layout: BoardLayout) => Promise<unknown>;
  reset?: () => Promise<unknown>;
  resetLabel?: string;
  /** Shown left of the Customize button (a greeting, a title, filters). */
  header?: React.ReactNode;
  /** Shown between the header and the widgets (warnings, a connect prompt). */
  notice?: React.ReactNode;
  emptyText?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState(saved);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [busy, start] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<BoardLayout | null>(null);

  // Outside edit mode the board follows what the server has (after a refresh, a reset or another device).
  useEffect(() => {
    if (!editing) setLayout(saved);
  }, [saved, editing]);

  const byId = useMemo(() => new Map(catalogue.map((w) => [w.def.id, w])), [catalogue]);
  const ids = layout.computer.map((it) => it.i);
  const missing = ids.some((id) => !(id in widgets));

  const flush = async () => {
    window.clearTimeout(timer.current);
    if (pending.current) {
      const l = pending.current;
      pending.current = null;
      await save(l);
    }
  };
  const change = (next: BoardLayout, opts: { now?: boolean } = {}) => {
    setLayout(next);
    pending.current = next;
    window.clearTimeout(timer.current);
    if (opts.now) void flush().then(() => router.refresh());
    else timer.current = window.setTimeout(() => void flush(), 700);
  };
  const add = (id: string, at?: { bp: Breakpoint; x: number; y: number }) => {
    const w = byId.get(id);
    if (w) change(addWidget(layout, w.def, at), { now: true }); // saved straight away so the server renders it
  };
  const done = () =>
    start(async () => {
      await flush();
      setEditing(false);
      if (missing) router.refresh();
    });

  const available = catalogue.filter((w) => !ids.includes(w.def.id));

  return (
    <div className={clsx("board", editing && "board-editing")}>
      <div className="mb-5 flex items-end justify-between gap-x-3 gap-y-3 max-sm:flex-wrap">
        <div className="min-w-0 flex-1">{header}</div>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            {reset && (
              <button
                type="button"
                className={buttonClass("gray", "sm")}
                disabled={busy}
                onClick={() =>
                  confirm(`${resetLabel}? Your arrangement is replaced.`) &&
                  start(async () => {
                    window.clearTimeout(timer.current);
                    pending.current = null;
                    await reset();
                    setEditing(false);
                    router.refresh();
                  })
                }
              >
                <RotateCcw size={14} /> {resetLabel}
              </button>
            )}
            <button type="button" className={buttonClass("gray", "sm")} onClick={() => setLibraryOpen((o) => !o)} aria-expanded={libraryOpen}>
              <Plus size={14} /> Widgets
            </button>
            <button type="button" className={buttonClass("filled", "sm")} onClick={done} disabled={busy}>
              <Check size={14} /> Done
            </button>
          </div>
        ) : (
          <button type="button" className={clsx(buttonClass("gray", "sm"), "max-sm:!size-10 max-sm:!rounded-full max-sm:!p-0")} onClick={() => setEditing(true)} aria-label="Customize">
            <LayoutGrid size={14} /> <span className="max-sm:hidden">Customize</span>
          </button>
        )}
      </div>

      {notice}
      {editing ? (
        <Editor
          layout={layout}
          widgets={widgets}
          catalogue={byId}
          onChange={(l) => change(l)}
          onRemove={(id) => change(removeWidget(layout, id))}
          onDrop={add}
          fallback={<StaticGrid layout={layout} widgets={widgets} />}
        />
      ) : ids.length ? (
        <StaticGrid layout={layout} widgets={widgets} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="glass grid min-h-40 w-full place-items-center rounded-[24px] p-6 text-[14px] text-label-2">
          {emptyText} Tap Customize to add widgets.
        </button>
      )}

      {editing && libraryOpen && <Library items={available} onAdd={(id) => add(id)} onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}

function StaticGrid({ layout, widgets }: { layout: BoardLayout; widgets: Record<string, React.ReactNode> }) {
  return (
    <div className="board-grid">
      {layout.computer.map((it, i) => (
        <div key={it.i} className="board-cell" style={cellStyle(layout, it.i, i)}>
          {widgets[it.i] ?? <div className="skeleton h-full rounded-[24px]" />}
        </div>
      ))}
    </div>
  );
}

/** The widget list: drag one onto the board (mouse), or tap + (anywhere, including phones). */
function Library({ items, onAdd, onClose }: { items: BoardWidget[]; onAdd: (id: string) => void; onClose: () => void }) {
  const groups = [...new Set(items.map((w) => w.group ?? ""))];
  return (
    <aside className="board-library glass" aria-label="Widgets">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <h2 className="flex-1 text-[15px] font-semibold">Widgets</h2>
        <button type="button" onClick={onClose} aria-label="Close widgets" className="grid size-8 place-items-center rounded-full bg-fill text-label-2 hover:text-label">
          <X size={15} />
        </button>
      </header>
      <p className="px-4 pb-2 text-[12px] text-label-2">Drag one onto the board, or tap +.</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {items.length === 0 && <p className="px-2 py-4 text-[13px] text-label-2">Everything is on the board.</p>}
        {groups.map((g) => (
          <div key={g} className="mb-2">
            {g && <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-label-3 uppercase">{g}</p>}
            {items
              .filter((w) => (w.group ?? "") === g)
              .map((w) => (
                <div
                  key={w.def.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", w.def.id);
                    e.dataTransfer.effectAllowed = "copy";
                    libraryDrag.id = w.def.id;
                  }}
                  onDragEnd={() => (libraryDrag.id = null)}
                  className="flex cursor-grab items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-fill active:cursor-grabbing"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{w.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{w.title}</span>
                    {w.hint && <span className="block truncate text-[12px] text-label-2">{w.hint}</span>}
                  </span>
                  <button type="button" onClick={() => onAdd(w.def.id)} aria-label={`Add ${w.title}`} className="grid size-8 shrink-0 place-items-center rounded-full bg-fill text-label hover:bg-ink hover:text-on-ink">
                    <Plus size={15} />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
