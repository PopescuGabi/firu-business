// Pure: boards people arrange themselves (Home, a client's dashboard). Widgets sit on a grid in whole cells;
// each board keeps one layout per size (computer 12 columns, tablet 6, phone 2). Unit-tested.

export type Breakpoint = "computer" | "tablet" | "phone";
export const BREAKPOINTS: Breakpoint[] = ["computer", "tablet", "phone"];
export const COLS: Record<Breakpoint, number> = { computer: 12, tablet: 6, phone: 2 };
/** The board's own width (not the window's) from which each layout is used. */
export const MIN_WIDTH: Record<Breakpoint, number> = { computer: 940, tablet: 600, phone: 0 };
export const ROW_HEIGHT = 64;

/** Where boards are saved: Home in the person's settings, a client's own arrangement of a shared dashboard too. */
export const HOME_BOARD_KEY = "homeBoard";
export const sharedBoardKey = (linkId: number) => `board:link:${linkId}`;
export const GAP = 16;

export type Item = { i: string; x: number; y: number; w: number; h: number };
export type BoardLayout = Record<Breakpoint, Item[]>;
export type Size = { w: number; h: number };

/** A widget's sizes, given for the computer layout (12 columns); tablet and phone sizes are derived. */
export type WidgetDef = {
  id: string;
  size: Size;
  min?: Size;
  max?: Size;
  /** Columns on a phone (of 2). */
  phoneW?: 1 | 2;
  /** Rows on a phone and on a tablet, for widgets that need more height when narrower. */
  phoneH?: number;
  tabletH?: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The default, smallest and largest size of a widget in one layout. */
export function sizesFor(def: WidgetDef, bp: Breakpoint): { size: Size; min: Size; max: Size } {
  const min = { w: def.min?.w ?? 2, h: def.min?.h ?? 2 };
  const max = { w: def.max?.w ?? 12, h: def.max?.h ?? 12 };
  if (bp === "computer") return { size: { w: clamp(def.size.w, min.w, max.w), h: clamp(def.size.h, min.h, max.h) }, min, max };
  if (bp === "tablet") {
    const tMin = { w: clamp(Math.ceil(min.w / 2), 1, 6), h: min.h };
    const tMax = { w: clamp(Math.ceil(max.w / 2), tMin.w, 6), h: max.h };
    return { size: { w: clamp(Math.round(def.size.w / 2), tMin.w, tMax.w), h: clamp(def.tabletH ?? def.size.h, min.h, max.h) }, min: tMin, max: tMax };
  }
  const pMin = { w: min.w <= 3 ? 1 : 2, h: min.h };
  const w = def.phoneW ?? (def.size.w <= 3 ? 1 : 2);
  return { size: { w: Math.max(w, pMin.w), h: clamp(def.phoneH ?? def.size.h, min.h, max.h) }, min: pMin, max: { w: 2, h: max.h } };
}

export const collides = (a: Item, b: Item) => a.i !== b.i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The top-most, then left-most free cell where a widget of this size fits. */
export function firstFreeSpot(items: Item[], size: Size, cols: number): { x: number; y: number } {
  const w = Math.min(size.w, cols);
  for (let y = 0; ; y++) {
    for (let x = 0; x + w <= cols; x++) {
      const probe = { i: "\0", x, y, w, h: size.h };
      if (!items.some((it) => collides(probe, it))) return { x, y };
    }
  }
}

/** Removes overlaps and gaps above widgets (each moves up as far as it can), in reading order. */
export function compact(items: Item[], cols: number): Item[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Item[] = [];
  for (const it of sorted) {
    const w = clamp(it.w, 1, cols);
    const placed = { ...it, w, x: clamp(it.x, 0, cols - w), y: 0 };
    while (out.some((o) => collides(placed, o))) placed.y++;
    out.push(placed);
  }
  return out;
}

const readingOrder = (items: Item[]) => [...items].sort((a, b) => a.y - b.y || a.x - b.x).map((it) => it.i);

/** Lays widgets out one after another, each in the first free spot, at their default size for this layout. */
export function flow(ids: string[], defs: Map<string, WidgetDef>, bp: Breakpoint, start: Item[] = []): Item[] {
  const items = [...start];
  for (const id of ids) {
    const def = defs.get(id);
    if (!def || items.some((it) => it.i === id)) continue;
    const { size } = sizesFor(def, bp);
    items.push({ i: id, ...firstFreeSpot(items, size, COLS[bp]), ...size });
  }
  return items;
}

function parseItems(v: unknown, defs: Map<string, WidgetDef>, bp: Breakpoint): Item[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const def = typeof r.i === "string" ? defs.get(r.i) : undefined;
    const nums = [r.x, r.y, r.w, r.h];
    if (!def || seen.has(def.id) || !nums.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    seen.add(def.id);
    const { min, max } = sizesFor(def, bp);
    const cols = COLS[bp];
    const w = clamp(Math.round(r.w as number), Math.min(min.w, cols), Math.min(max.w, cols));
    const h = clamp(Math.round(r.h as number), min.h, max.h);
    out.push({ i: def.id, x: clamp(Math.round(r.x as number), 0, cols - w), y: Math.max(0, Math.round(r.y as number)), w, h });
  }
  return out;
}

/**
 * Turns whatever was saved into a valid board for the widgets available now: drops unknown or unavailable widgets,
 * fixes sizes and overlaps, and fills a layout that was never arranged (or misses widgets) from the computer one.
 * With nothing saved, `fallback` (widget ids in reading order) is the board.
 */
export function normalizeLayout(saved: unknown, available: WidgetDef[], fallback: string[]): BoardLayout {
  const defs = new Map(available.map((d) => [d.id, d]));
  const s = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : null;
  const computer = s && Array.isArray(s.computer) ? compact(parseItems(s.computer, defs, "computer"), COLS.computer) : flow(fallback, defs, "computer");
  const order = readingOrder(computer);
  const onBoard = new Set(order);
  const out = { computer } as BoardLayout;
  for (const bp of ["tablet", "phone"] as const) {
    const mine = s ? parseItems(s[bp], defs, bp).filter((it) => onBoard.has(it.i)) : [];
    out[bp] = compact(flow(order, defs, bp, compact(mine, COLS[bp])), COLS[bp]);
  }
  return out;
}

/** Puts a widget on every layout of the board, in the first free spot (or at `at` in one layout, where it was dropped). */
export function addWidget(layout: BoardLayout, def: WidgetDef, at?: { bp: Breakpoint; x: number; y: number }): BoardLayout {
  const out = {} as BoardLayout;
  for (const bp of BREAKPOINTS) {
    const items = layout[bp].filter((it) => it.i !== def.id);
    const { size } = sizesFor(def, bp);
    const pos = at?.bp === bp ? { x: at.x, y: at.y } : firstFreeSpot(items, size, COLS[bp]);
    // A dropped widget keeps its spot; the ones it lands on move down.
    const dropped = { i: def.id, ...pos, ...size };
    const pushed = items.map((it) => (collides(dropped, it) ? { ...it, y: it.y + 1000 } : it));
    out[bp] = compact([dropped, ...pushed], COLS[bp]);
  }
  return out;
}

export function removeWidget(layout: BoardLayout, id: string): BoardLayout {
  const out = {} as BoardLayout;
  for (const bp of BREAKPOINTS) out[bp] = compact(layout[bp].filter((it) => it.i !== id), COLS[bp]);
  return out;
}

/** The ids on a board (in the computer layout's reading order). */
export const boardIds = (layout: BoardLayout) => readingOrder(layout.computer);
