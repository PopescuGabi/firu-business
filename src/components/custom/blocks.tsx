import clsx from "clsx";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";
import { addItem, addLink, deleteItem, setItemField, updateItem } from "@/app/actions/custom-pages";
import { chartData, computeStat, formatValue, type Block, type Collection, type ItemData, type Spec } from "@/lib/custom-pages";
import { Bars } from "../charts";
import { Sheet } from "../sheet";
import { DeleteFooter, Submit } from "../submit";
import { buttonClass, Card } from "../ui";
import { ItemForm } from "./item-form";
import { CheckRow, NotesBox } from "./live";

type Item = { id: number; collection: string; data: ItemData };
type Ctx = { pageId: number; spec: Spec; items: Item[]; today: string; preview: boolean };

const WIDE = new Set<Block["type"]>(["board", "table", "cards"]);
const singular = (c: Collection) => c.singular ?? c.name.replace(/s$/i, "");
const titleOf = (c: Collection, d: ItemData) => String(d[c.titleField] ?? "Untitled");
/** Up to three filled-in fields besides the title, for cards. */
const details = (c: Collection, d: ItemData, skip: string[] = []) =>
  c.fields
    .filter((f) => f.key !== c.titleField && !skip.includes(f.key) && f.type !== "longtext")
    .map((f) => ({ f, v: formatValue(f, d[f.key]) }))
    .filter((x) => x.v)
    .slice(0, 3);

function AddButton({ ctx, c }: { ctx: Ctx; c: Collection }) {
  if (ctx.preview) return null;
  return (
    <Sheet title={`New ${singular(c).toLowerCase()}`} trigger={<><Plus size={14} /> Add</>} triggerClassName={buttonClass("plain", "sm")}>
      <ItemForm collection={c} action={addItem.bind(null, ctx.pageId, c.key)} submitLabel="Add" />
    </Sheet>
  );
}

/** An entry as a tappable card: opens its form; right-click moves or deletes it. */
function ItemCard({ ctx, c, item, groupBy, className }: { ctx: Ctx; c: Collection; item: Item; groupBy?: string; className?: string }) {
  const group = groupBy ? c.fields.find((f) => f.key === groupBy) : undefined;
  const menu = [
    ...(group?.options ?? []).filter((o) => o !== item.data[group!.key]).map((o) => ({ label: `Move to ${o}`, action: setItemField.bind(null, item.id, group!.key, o) })),
    { label: "Delete", destructive: true, confirm: `Delete “${titleOf(c, item.data)}”?`, action: deleteItem.bind(null, item.id) },
  ];
  return (
    <Sheet
      title={titleOf(c, item.data)}
      menu={menu}
      triggerClassName={clsx("w-full cursor-pointer rounded-[16px] bg-well p-3 text-left transition hover:brightness-105", className)}
      trigger={
        <>
          <p className="truncate text-[15px] font-semibold">{titleOf(c, item.data)}</p>
          {details(c, item.data, groupBy ? [groupBy] : []).map(({ f, v }) => (
            <p key={f.key} className="truncate text-[12px] text-label-2">
              <span className="text-label-3">{f.label}:</span> {v}
            </p>
          ))}
        </>
      }
    >
      <ItemForm collection={c} action={updateItem.bind(null, item.id)} data={item.data} submitLabel="Save" />
      <DeleteFooter action={deleteItem.bind(null, item.id)} message={`Delete “${titleOf(c, item.data)}”?`}>
        <Trash2 size={15} /> Delete
      </DeleteFooter>
    </Sheet>
  );
}

function sorted(items: Item[], c: Collection, sortBy?: string, desc?: boolean) {
  if (!sortBy) return items;
  const f = c.fields.find((x) => x.key === sortBy);
  const num = f && ["number", "money", "rating"].includes(f.type);
  return [...items].sort((a, b) => {
    const x = a.data[sortBy] ?? "";
    const y = b.data[sortBy] ?? "";
    const r = num ? Number(x) - Number(y) : String(x).localeCompare(String(y));
    return desc ? -r : r;
  });
}

function BlockBody({ ctx, b }: { ctx: Ctx; b: Block }) {
  if (b.type === "notes") {
    const note = ctx.items.find((i) => i.collection === `note:${b.id}`);
    return ctx.preview ? <p className="text-[14px] text-label-3">Free notes, saved as you type.</p> : <NotesBox pageId={ctx.pageId} blockId={b.id} initial={String(note?.data.text ?? "")} />;
  }
  if (b.type === "links") {
    const links = ctx.items.filter((i) => i.collection === `links:${b.id}`);
    return (
      <div className="flex flex-col gap-1">
        {links.length === 0 && <p className="text-[14px] text-label-3">Quick links you open often.</p>}
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-[12px] px-2 py-1 hover:bg-fill">
            <a href={String(l.data.url)} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-[15px] text-accent">
              <ExternalLink size={14} className="shrink-0" /> <span className="truncate">{String(l.data.label)}</span>
            </a>
            <form action={deleteItem.bind(null, l.id)}>
              <button aria-label={`Remove ${l.data.label}`} className="cursor-pointer rounded-full p-1 text-label-3 hover:bg-fill-2 hover:text-red">
                <X size={14} />
              </button>
            </form>
          </div>
        ))}
        {!ctx.preview && (
          <form action={addLink.bind(null, ctx.pageId, b.id)} className="mt-1 grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <input name="label" placeholder="Name" aria-label="Link name" className="field h-9 text-[14px]" />
            <input name="url" type="url" required placeholder="https://" aria-label="Link address" className="field h-9 text-[14px]" />
            <Submit size="sm" variant="gray">
              Add
            </Submit>
          </form>
        )}
      </div>
    );
  }

  const c = ctx.spec.collections.find((x) => x.key === b.collection)!;
  const items = ctx.items.filter((i) => i.collection === c.key);
  const empty = <p className="text-[14px] text-label-3">{ctx.preview ? `Your ${c.name.toLowerCase()} appear here.` : `No ${c.name.toLowerCase()} yet.`}</p>;

  switch (b.type) {
    case "board": {
      const f = c.fields.find((x) => x.key === b.groupBy)!;
      const cols = [...(f.options ?? []), ""];
      return (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {cols.map((o) => {
            const list = items.filter((i) => (i.data[f.key] ?? "") === o);
            if (o === "" && !list.length) return null;
            return (
              <div key={o || "none"} className="flex w-[240px] shrink-0 snap-start flex-col gap-2 rounded-[18px] bg-fill p-2">
                <p className="flex justify-between px-1 text-[12px] font-semibold text-label-2 uppercase">
                  <span>{o || `No ${f.label.toLowerCase()}`}</span>
                  <span className="tabular-nums">{list.length}</span>
                </p>
                {list.map((i) => (
                  <ItemCard key={i.id} ctx={ctx} c={c} item={i} groupBy={f.key} />
                ))}
              </div>
            );
          })}
        </div>
      );
    }
    case "table": {
      const cols = (b.columns?.length ? b.columns : c.fields.map((f) => f.key)).map((k) => c.fields.find((f) => f.key === k)).filter((f) => f && f.type !== "longtext").slice(0, 6);
      const rows = sorted(items, c, b.sortBy, b.desc);
      const grid = { gridTemplateColumns: `repeat(${cols.length}, minmax(90px, 1fr))` };
      return (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="grid gap-3 border-b border-separator px-3 pb-2 text-[12px] font-semibold text-label-2 uppercase" style={grid}>
              {cols.map((f) => (
                <span key={f!.key}>{f!.label}</span>
              ))}
            </div>
            {rows.length === 0 && <div className="px-3 py-3">{empty}</div>}
            {rows.map((i) => (
              <Sheet
                key={i.id}
                title={titleOf(c, i.data)}
                menu={[{ label: "Delete", destructive: true, confirm: `Delete “${titleOf(c, i.data)}”?`, action: deleteItem.bind(null, i.id) }]}
                triggerClassName="grid w-full cursor-pointer gap-3 border-b border-separator px-3 py-2 text-left text-[14px] hover:bg-fill"
                triggerStyle={grid}
                trigger={cols.map((f) => (
                  <span key={f!.key} className={clsx("truncate", f!.key === c.titleField && "font-semibold")}>
                    {formatValue(f!, i.data[f!.key]) || "—"}
                  </span>
                ))}
              >
                <ItemForm collection={c} action={updateItem.bind(null, i.id)} data={i.data} submitLabel="Save" />
                <DeleteFooter action={deleteItem.bind(null, i.id)} message={`Delete “${titleOf(c, i.data)}”?`}>
                  <Trash2 size={15} /> Delete
                </DeleteFooter>
              </Sheet>
            ))}
          </div>
        </div>
      );
    }
    case "cards":
      return items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted(items, c, b.sortBy, b.desc).map((i) => (
            <ItemCard key={i.id} ctx={ctx} c={c} item={i} />
          ))}
        </div>
      ) : (
        empty
      );
    case "checklist": {
      const open = items.filter((i) => !i.data[b.doneField]);
      const done = items.filter((i) => i.data[b.doneField]);
      return items.length ? (
        <div className="flex flex-col">
          {[...open, ...done].map((i) => (ctx.preview ? null : <CheckRow key={i.id} itemId={i.id} field={b.doneField} done={Boolean(i.data[b.doneField])} label={titleOf(c, i.data)} />))}
        </div>
      ) : (
        empty
      );
    }
    case "stats":
      return (
        <div className="grid grid-cols-2 gap-2">
          {b.stats.map((s, k) => {
            const v = computeStat(c, items.map((i) => i.data), s, ctx.today);
            const f = s.field ? c.fields.find((x) => x.key === s.field) : undefined;
            return (
              <div key={k} className="rounded-[16px] bg-well px-3 py-2.5">
                <p className="text-[12px] text-label-2">{s.label}</p>
                <p className="text-[22px] font-bold tabular-nums">{s.op === "count" || !f ? Math.round(v) : formatValue(f, Math.round(v * 100) / 100)}</p>
              </div>
            );
          })}
        </div>
      );
    case "chart": {
      const { labels, values } = chartData(c, items.map((i) => i.data), b, ctx.today);
      return labels.length ? <Bars labels={labels} series={[{ label: b.title, values }]} highlight={b.by === "month" ? labels.length - 1 : undefined} /> : empty;
    }
    case "upcoming": {
      const f = c.fields.find((x) => x.key === b.dateField)!;
      const next = items
        .filter((i) => String(i.data[f.key] ?? "").slice(0, 10) >= ctx.today)
        .sort((a, z) => String(a.data[f.key]).localeCompare(String(z.data[f.key])))
        .slice(0, b.limit);
      return next.length ? (
        <ul className="flex flex-col divide-y divide-separator">
          {next.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2 text-[14px]">
              <span className="truncate font-medium">{titleOf(c, i.data)}</span>
              <span className="shrink-0 text-label-2">{formatValue(f, i.data[f.key])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-label-3">Nothing coming up.</p>
      );
    }
  }
}

/** One block's content without its card (Home tiles). */
export function BlockContent({ pageId, spec, items, today, block }: { pageId: number; spec: Spec; items: Item[]; today: string; block: Block }) {
  return <BlockBody ctx={{ pageId, spec, items, today, preview: false }} b={block} />;
}

/** Every block of a custom page, in a two-column grid (boards, tables and cards take the full width). */
export function PageBlocks({ pageId, spec, items, today, preview = false }: { pageId: number; spec: Spec; items: Item[]; today: string; preview?: boolean }) {
  const ctx: Ctx = { pageId, spec, items, today, preview };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {spec.blocks.map((b) => {
        const c = "collection" in b ? spec.collections.find((x) => x.key === b.collection) : undefined;
        const addable = c && ["board", "table", "cards", "checklist"].includes(b.type);
        return (
          <Card key={b.id} className={clsx("flex flex-col gap-3 p-4", WIDE.has(b.type) && "lg:col-span-2")}>
            <div className="flex items-center gap-2">
              <h2 className="mr-auto text-[17px] font-semibold">{b.title}</h2>
              {addable && <AddButton ctx={ctx} c={c!} />}
            </div>
            <BlockBody ctx={ctx} b={b} />
          </Card>
        );
      })}
    </div>
  );
}

