"use client";
// The board in edit mode: drag (handle on touch, the whole tile with a mouse), resize from the corner in grid steps,
// remove, and drop widgets from the library. Loaded only when someone presses Customize.
import { useEffect, useMemo, useState } from "react";
import { Responsive, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { GripHorizontal, X } from "lucide-react";
import { BREAKPOINTS, COLS, GAP, MIN_WIDTH, ROW_HEIGHT, sizesFor, type BoardLayout, type Breakpoint, type Item } from "@/lib/board";
import type { BoardWidget } from "./board";
import { libraryDrag } from "./drag-state";

const bpFor = (width: number): Breakpoint => BREAKPOINTS.find((bp) => width >= MIN_WIDTH[bp]) ?? "phone";
const clean = (items: Layout): Item[] => items.filter((it) => it.i !== "__drop__").map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
const same = (a: Item[], b: Item[]) =>
  a.length === b.length && a.every((it) => b.some((o) => o.i === it.i && o.x === it.x && o.y === it.y && o.w === it.w && o.h === it.h));

export default function BoardEditor({
  layout,
  widgets,
  catalogue,
  onChange,
  onRemove,
  onDrop,
  fallback,
}: {
  layout: BoardLayout;
  widgets: Record<string, React.ReactNode>;
  catalogue: Map<string, BoardWidget>;
  onChange: (layout: BoardLayout) => void;
  onRemove: (id: string) => void;
  onDrop: (id: string, at: { bp: Breakpoint; x: number; y: number }) => void;
  fallback: React.ReactNode;
}) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const bp = bpFor(width);
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(window.matchMedia("(pointer: fine)").matches), []);

  // Each item carries its own smallest and largest size for this layout.
  const layouts = useMemo(() => {
    const out = {} as Record<Breakpoint, LayoutItem[]>;
    for (const b of BREAKPOINTS)
      out[b] = layout[b].map((it) => {
        const def = catalogue.get(it.i)?.def;
        const s = def ? sizesFor(def, b) : null;
        return { ...it, minW: s?.min.w, minH: s?.min.h, maxW: s?.max.w, maxH: s?.max.h };
      });
    return out;
  }, [layout, catalogue]);

  const dragged = () => {
    const def = libraryDrag.id ? catalogue.get(libraryDrag.id)?.def : undefined;
    return def ? sizesFor(def, bp).size : { w: 4, h: 3 };
  };

  return (
    <div ref={containerRef}>
      {!mounted ? (
        fallback
      ) : (
        <Responsive
          width={width}
          breakpoints={MIN_WIDTH}
          cols={COLS}
          layouts={layouts}
          rowHeight={ROW_HEIGHT}
          margin={[GAP, GAP]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: true, handle: fine ? ".board-handle" : ".board-grip", cancel: ".board-remove", threshold: 4 }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          dropConfig={{ enabled: true, defaultItem: { w: 4, h: 3 }, onDragOver: () => dragged() }}
          droppingItem={{ i: "__drop__", x: 0, y: 0, ...dragged() }}
          onLayoutChange={(current) => {
            const next = clean(current);
            if (!same(next, layout[bp])) onChange({ ...layout, [bp]: next });
          }}
          onDrop={(_l, item, e) => {
            const id = libraryDrag.id ?? (e as DragEvent).dataTransfer?.getData("text/plain");
            libraryDrag.id = null;
            if (id && item && catalogue.has(id)) onDrop(id, { bp, x: item.x, y: item.y });
          }}
        >
          {layout[bp].map((it) => {
            const w = catalogue.get(it.i);
            return (
              <div key={it.i} className="board-item">
                <div className="board-item-body">{widgets[it.i] ?? <div className="skeleton h-full rounded-[24px]" />}</div>
                <div aria-hidden className="board-shield board-handle" />
                <button type="button" className="board-grip board-handle" aria-label={`Move ${w?.title ?? "widget"}`}>
                  <GripHorizontal size={16} />
                </button>
                <button
                  type="button"
                  className="board-remove"
                  aria-label={`Remove ${w?.title ?? "widget"}`}
                  onClick={() => onRemove(it.i)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </Responsive>
      )}
    </div>
  );
}
