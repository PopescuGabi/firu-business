"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { createCustomPage } from "@/app/actions/setup";
import { FIELD_TYPES, LIMITS, PAGE_COLORS, PAGE_ICONS, parsePageDraft, slugKey, type FieldType } from "@/lib/custom-pages";
import { PageBlocks } from "./custom/blocks";
import { PAGE_ICON } from "./custom/icons";
import { LiquidButton, type LiquidState } from "./liquid-button";
import { buttonClass, Field } from "./ui";

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Text",
  longtext: "Long text",
  number: "Number",
  money: "Money",
  date: "Date",
  datetime: "Date & time",
  select: "Choice (status…)",
  checkbox: "Yes / no",
  url: "Link",
  rating: "Rating ★",
};

/** "Total" stays "Total"; "Price" becomes "Total price". */
const totalLabel = (l: string) => (/^total/i.test(l.trim()) ? l.trim() : `Total ${l.trim().toLowerCase()}`);

type F = { id: number; label: string; type: FieldType; options: string; unit: string };
let nextId = 10;

function BlockToggle({ on, onToggle, label, children, disabled }: { on: boolean; onToggle: () => void; label: string; children?: React.ReactNode; disabled?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2 rounded-[14px] px-2 py-1.5", disabled && "opacity-50")}>
      <label className="flex cursor-pointer items-center gap-2 text-[14px] font-medium">
        <input type="checkbox" checked={on && !disabled} disabled={Boolean(disabled)} onChange={onToggle} className="size-4 accent-[var(--accent)]" />
        {label}
      </label>
      {children}
      {disabled && <span className="text-[12px] text-label-3">{disabled}</span>}
    </div>
  );
}

function FieldSelect({ value, onChange, list, label }: { value: string; onChange: (v: string) => void; list: { key: string; label: string }[]; label: string }) {
  if (list.length > 1)
    return (
      <select value={value || list[0]?.key} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 rounded-[10px] bg-fill px-2 text-[13px]">
        {list.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    );
  return list[0] ? <span className="text-[13px] text-label-2">{list[0].label}</span> : null;
}

/**
 * Build a page by hand: one list with your own fields, then the blocks to show it. The result is the same
 * kind of spec the AI writes, checked by the same rules on the server.
 */
export function PageBuilder({ today, onDone }: { today: string; onDone?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string>("list");
  const [color, setColor] = useState<string>(PAGE_COLORS[0]);
  const [listName, setListName] = useState("Items");
  const [fields, setFields] = useState<F[]>([
    { id: 1, label: "Name", type: "text", options: "", unit: "" },
    { id: 2, label: "Status", type: "select", options: "To do, Doing, Done", unit: "" },
    { id: 3, label: "Date", type: "date", options: "", unit: "" },
  ]);
  const [blocks, setBlocks] = useState({ board: true, table: true, cards: false, checklist: false, upcoming: true, stats: true, chart: false, notes: false, links: false });
  const [boardBy, setBoardBy] = useState("");
  const [doneBy, setDoneBy] = useState("");
  const [dateBy, setDateBy] = useState("");
  const [sumBy, setSumBy] = useState("");
  const [state, setState] = useState<LiquidState>("idle");
  const [error, setError] = useState<string | null>(null);

  const keyed = useMemo(() => {
    const seen = new Set<string>();
    return fields
      .filter((f) => f.label.trim())
      .map((f) => {
        let k = slugKey(f.label);
        for (let i = 2; seen.has(k); i++) k = `${slugKey(f.label)}_${i}`;
        seen.add(k);
        return { ...f, key: k };
      });
  }, [fields]);
  const of = (types: FieldType[]) => keyed.filter((f) => types.includes(f.type));
  const pick = (chosen: string, list: { key: string }[]) => list.find((f) => f.key === chosen)?.key ?? list[0]?.key;

  const draft = useMemo(() => {
    const col = slugKey(listName || "items");
    const selects = of(["select"]);
    const checks = of(["checkbox"]);
    const dates = of(["date", "datetime"]);
    const nums = of(["number", "money", "rating"]);
    const board = pick(boardBy, selects);
    const done = pick(doneBy, checks);
    const date = pick(dateBy, dates);
    const sum = nums.find((f) => f.key === sumBy)?.key;
    const b: Record<string, unknown>[] = [];
    if (blocks.board && board) b.push({ type: "board", id: "board", title: `By ${selects.find((f) => f.key === board)!.label.toLowerCase()}`, collection: col, groupBy: board });
    if (blocks.upcoming && date) b.push({ type: "upcoming", id: "upcoming", title: "Coming up", collection: col, dateField: date, limit: 5, home: true });
    if (blocks.stats)
      b.push({
        type: "stats",
        id: "stats",
        title: "Totals",
        collection: col,
        stats: [
          { label: listName || "Items", op: "count" },
          ...(date ? [{ label: "This month", op: "count", period: "month" }] : []),
          ...(sum ? [{ label: totalLabel(keyed.find((f) => f.key === sum)!.label), op: "sum", field: sum }] : []),
        ],
      });
    if (blocks.chart && date) b.push({ type: "chart", id: "chart", title: sum ? `${keyed.find((f) => f.key === sum)!.label} by month` : "Per month", collection: col, op: sum ? "sum" : "count", field: sum, by: "month", dateField: date });
    if (blocks.checklist && done) b.push({ type: "checklist", id: "checklist", title: "Checklist", collection: col, doneField: done });
    if (blocks.cards) b.push({ type: "cards", id: "cards", title: listName || "Items", collection: col });
    if (blocks.table) b.push({ type: "table", id: "table", title: `All ${(listName || "items").toLowerCase()}`, collection: col, sortBy: date, desc: Boolean(date) });
    if (blocks.notes) b.push({ type: "notes", id: "notes", title: "Notes" });
    if (blocks.links) b.push({ type: "links", id: "links", title: "Links" });
    return {
      title: title.trim() || listName || "My page",
      icon,
      color,
      description: "",
      spec: {
        collections: [
          {
            key: col,
            name: listName || "Items",
            titleField: keyed.find((f) => f.type === "text")?.key ?? keyed[0]?.key ?? "name",
            fields: keyed.map((f) => ({
              key: f.key,
              label: f.label.trim(),
              type: f.type,
              ...(f.type === "select" ? { options: [...new Set(f.options.split(",").map((o) => o.trim()).filter(Boolean))].slice(0, LIMITS.options) } : {}),
              ...((f.type === "number" || f.type === "money") && f.unit.trim() ? { unit: f.unit.trim().slice(0, 8) } : {}),
            })),
          },
        ],
        blocks: b,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, icon, color, listName, keyed, blocks, boardBy, doneBy, dateBy, sumBy]);
  const checked = useMemo(() => parsePageDraft(draft), [draft]);

  const setField = (id: number, patch: Partial<F>) => setFields((all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const toggle = (k: keyof typeof blocks) => setBlocks((b) => ({ ...b, [k]: !b[k] }));

  async function create() {
    setState("busy");
    setError(null);
    const r = await createCustomPage(draft).catch(() => ({ ok: false as const, message: "Couldn't create the page." }));
    if (!r.ok) {
      setError(r.message);
      setState("idle");
      return;
    }
    setState("done");
    onDone?.();
    router.push(r.href);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Page name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="e.g. Orders" className="field" autoFocus />
        </Field>
        <Field label="What's in the list? (plural)" hint="e.g. Orders, Clients, Recipes, Shifts">
          <input value={listName} onChange={(e) => setListName(e.target.value)} maxLength={60} className="field" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Icon">
        {PAGE_ICONS.map((name) => {
          const Icon = PAGE_ICON[name];
          return (
            <button key={name} type="button" role="radio" aria-checked={icon === name} aria-label={name} onClick={() => setIcon(name)} className={clsx("grid size-8 cursor-pointer place-items-center rounded-[10px]", icon === name ? "bg-accent text-white" : "bg-fill text-label-2")}>
              <Icon size={15} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Colour">
        {PAGE_COLORS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={clsx("size-7 cursor-pointer rounded-full", color === c && "ring-2 ring-label ring-offset-2 ring-offset-[var(--bg)]")} style={{ background: c }} />
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-label-2 uppercase">Fields</h3>
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[1fr_9.5rem_auto] items-center gap-2">
            <input value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} maxLength={60} placeholder="Field name" aria-label={`Field ${i + 1} name`} className="field h-9 text-[14px]" />
            <select value={f.type} onChange={(e) => setField(f.id, { type: e.target.value as FieldType })} aria-label={`Field ${i + 1} type`} className="field h-9 py-0 text-[14px]">
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <button type="button" disabled={fields.length <= 1} onClick={() => setFields((all) => all.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.label || "field"}`} className="cursor-pointer rounded-full p-2 text-label-3 hover:bg-fill hover:text-red disabled:opacity-30">
              <Trash2 size={15} />
            </button>
            {f.type === "select" && (
              <input value={f.options} onChange={(e) => setField(f.id, { options: e.target.value })} placeholder="Choices, separated by commas" aria-label={`${f.label} choices`} className="field col-span-2 h-9 text-[13px]" />
            )}
            {(f.type === "number" || f.type === "money") && (
              <input value={f.unit} onChange={(e) => setField(f.id, { unit: e.target.value })} maxLength={8} placeholder={f.type === "money" ? "Currency, e.g. lei or €" : "Unit, e.g. h or km"} aria-label={`${f.label} unit`} className="field col-span-2 h-9 text-[13px]" />
            )}
          </div>
        ))}
        {fields.length < LIMITS.fields && (
          <button type="button" onClick={() => setFields((all) => [...all, { id: nextId++, label: "", type: "text", options: "", unit: "" }])} className={clsx(buttonClass("plain", "sm"), "self-start")}>
            <Plus size={14} /> Add field
          </button>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="text-[13px] font-semibold text-label-2 uppercase">Show it as</h3>
        <BlockToggle on={blocks.board} onToggle={() => toggle("board")} label="Board grouped by" disabled={of(["select"]).length ? undefined : "needs a Choice field"}>
          <FieldSelect value={boardBy} onChange={setBoardBy} list={of(["select"])} label="Group the board by" />
        </BlockToggle>
        <BlockToggle on={blocks.upcoming} onToggle={() => toggle("upcoming")} label="Coming up, by" disabled={of(["date", "datetime"]).length ? undefined : "needs a Date field"}>
          <FieldSelect value={dateBy} onChange={setDateBy} list={of(["date", "datetime"])} label="Date field" />
        </BlockToggle>
        <BlockToggle on={blocks.stats} onToggle={() => toggle("stats")} label="Totals, and the sum of">
          <select value={sumBy} onChange={(e) => setSumBy(e.target.value)} aria-label="Field to add up" className="h-8 rounded-[10px] bg-fill px-2 text-[13px]">
            <option value="">nothing</option>
            {of(["number", "money", "rating"]).map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </BlockToggle>
        <BlockToggle on={blocks.chart} onToggle={() => toggle("chart")} label="Chart per month" disabled={of(["date", "datetime"]).length ? undefined : "needs a Date field"} />
        <BlockToggle on={blocks.checklist} onToggle={() => toggle("checklist")} label="Checklist ticked by" disabled={of(["checkbox"]).length ? undefined : "needs a Yes / no field"}>
          <FieldSelect value={doneBy} onChange={setDoneBy} list={of(["checkbox"])} label="Checkbox field" />
        </BlockToggle>
        <BlockToggle on={blocks.table} onToggle={() => toggle("table")} label="Table" />
        <BlockToggle on={blocks.cards} onToggle={() => toggle("cards")} label="Cards" />
        <BlockToggle on={blocks.notes} onToggle={() => toggle("notes")} label="Notes" />
        <BlockToggle on={blocks.links} onToggle={() => toggle("links")} label="Links" />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold text-label-2 uppercase">Preview</h3>
        {checked.draft ? (
          <div className="pointer-events-none rounded-[20px] bg-fill/50 p-3 select-none">
            <PageBlocks pageId={0} spec={checked.draft.spec} items={[]} today={today} preview />
          </div>
        ) : (
          <p className="text-[13px] text-label-2">Pick at least one way to show it.</p>
        )}
      </section>

      {error && (
        <p role="alert" className="text-[13px] text-red">
          {error}
        </p>
      )}
      <LiquidButton className="self-end" state={state} disabled={state === "busy" || !checked.draft} onClick={create} icon={<Plus size={15} />} label="Create page" busyLabel="Creating…" doneLabel="Created" />
    </div>
  );
}
