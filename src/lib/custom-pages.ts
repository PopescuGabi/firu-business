// Pure (no server imports): custom pages are a JSON spec rendered from fixed building blocks.
// The AI only ever writes this spec; it never writes code or HTML. Everything is checked here before it's saved.
import { z } from "zod";

export const FIELD_TYPES = ["text", "longtext", "number", "money", "date", "datetime", "select", "checkbox", "url", "rating"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Icons a page may use (names of lucide icons; the nav maps them). */
export const PAGE_ICONS = [
  "briefcase", "camera", "wrench", "hammer", "ruler", "cpu", "code", "flask", "stethoscope", "book", "pen", "palette",
  "music", "film", "home", "car", "plane", "map", "calendar", "clock", "list", "kanban", "chart", "wallet",
  "package", "users", "heart", "leaf", "utensils", "graduation", "dumbbell", "star",
] as const;
export type PageIcon = (typeof PAGE_ICONS)[number];

export const PAGE_COLORS = ["#0A84FF", "#30D158", "#FF9F0A", "#FF375F", "#BF5AF2", "#64D2FF", "#FFD60A", "#AC8E68"] as const;

export const LIMITS = { collections: 4, fields: 16, options: 12, blocks: 10, pagesPerSetup: 4, pagesPerPerson: 12 } as const;

/** "Client name!" → "client_name" (keys inside the spec and in each item's data). */
export const slugKey = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "field";

/** URL slug for a page title, e.g. "Shoots & clients" → "shoots-clients". */
export const slugPage = (s: string) => slugKey(s).replace(/_/g, "-").slice(0, 48) || "page";

const label = z.string().trim().min(1).max(60);
const key = z.string().trim().min(1).max(40).transform(slugKey);

export const fieldSchema = z.object({
  key,
  label,
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(40)).max(LIMITS.options).optional(),
  unit: z.string().trim().max(8).optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const collectionSchema = z.object({
  key,
  name: label, // plural, e.g. "Shoots"
  singular: label.optional(), // e.g. "Shoot"
  titleField: key,
  fields: z.array(fieldSchema).min(1).max(LIMITS.fields),
});
export type Collection = z.infer<typeof collectionSchema>;

const base = { id: key, title: label };
const stat = z.object({
  label,
  op: z.enum(["count", "sum", "avg"]),
  field: key.optional(),
  period: z.enum(["all", "month"]).default("all"),
  where: z.object({ field: key, value: z.string().max(40) }).optional(),
});
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("board"), collection: key, groupBy: key }),
  z.object({ ...base, type: z.literal("table"), collection: key, columns: z.array(key).max(8).optional(), sortBy: key.optional(), desc: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("cards"), collection: key, sortBy: key.optional(), desc: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("checklist"), collection: key, doneField: key }),
  z.object({ ...base, type: z.literal("stats"), collection: key, stats: z.array(stat).min(1).max(4), home: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("chart"), collection: key, op: z.enum(["count", "sum"]), field: key.optional(), by: z.string().max(40), dateField: key.optional() }),
  z.object({ ...base, type: z.literal("upcoming"), collection: key, dateField: key, limit: z.number().int().min(1).max(10).default(5), home: z.boolean().optional() }),
  z.object({ ...base, type: z.literal("notes") }),
  z.object({ ...base, type: z.literal("links") }),
]);
export type Block = z.infer<typeof blockSchema>;

export const specSchema = z.object({
  collections: z.array(collectionSchema).max(LIMITS.collections),
  blocks: z.array(blockSchema).min(1).max(LIMITS.blocks),
});
export type Spec = z.infer<typeof specSchema>;

export const pageDraftSchema = z.object({
  title: label,
  icon: z.enum(PAGE_ICONS).catch("list"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch(PAGE_COLORS[0]),
  description: z.string().max(200).default(""),
  spec: specSchema,
});
export type PageDraft = z.infer<typeof pageDraftSchema>;

const NUMERIC: FieldType[] = ["number", "money", "rating"];
const DATES: FieldType[] = ["date", "datetime"];

/**
 * Checks that every block points at real collections and fields of the right type. Broken blocks are dropped
 * (with a reason), collections whose title field is missing are fixed, and duplicate keys are made unique.
 */
export function checkSpec(spec: Spec): { spec: Spec; problems: string[] } {
  const problems: string[] = [];
  const seen = new Set<string>();
  const unique = (k: string) => {
    let out = k;
    for (let i = 2; seen.has(out); i++) out = `${k}_${i}`;
    seen.add(out);
    return out;
  };
  const collections = spec.collections.map((c) => {
    const fieldKeys = new Set<string>();
    let fields: Field[] = c.fields
      .filter((f) => (fieldKeys.has(f.key) ? false : (fieldKeys.add(f.key), true)))
      .map((f) => (f.type === "select" && !f.options?.length ? { ...f, type: "text" as const } : f));
    // Every entry needs a name: the title field must be a text field (one is added if there's none).
    let titleField = fields.find((f) => f.key === c.titleField && f.type === "text")?.key ?? fields.find((f) => f.type === "text")?.key;
    if (!titleField) {
      titleField = fieldKeys.has("name") ? "title" : "name";
      fields = [{ key: titleField, label: "Name", type: "text" as const }, ...fields].slice(0, LIMITS.fields);
    }
    return { ...c, key: unique(c.key), fields, titleField };
  });
  const col = (k: string) => collections.find((c) => c.key === k);
  const field = (c: Collection, k?: string) => (k ? c.fields.find((f) => f.key === k) : undefined);
  const blockIds = new Set<string>();
  const blocks = spec.blocks.filter((b) => {
    const why = (msg: string) => (problems.push(`${b.title}: ${msg}`), false);
    if (blockIds.has(b.id)) return why("duplicate block");
    blockIds.add(b.id);
    if (b.type === "notes" || b.type === "links") return true;
    const c = col(b.collection);
    if (!c) return why(`no collection "${b.collection}"`);
    switch (b.type) {
      case "board":
        return field(c, b.groupBy)?.type === "select" || why("board needs a select field to group by");
      case "checklist":
        return field(c, b.doneField)?.type === "checkbox" || why("checklist needs a checkbox field");
      case "upcoming":
        return DATES.includes(field(c, b.dateField)?.type as FieldType) || why("upcoming needs a date field");
      case "chart": {
        if (b.op === "sum" && !NUMERIC.includes(field(c, b.field)?.type as FieldType)) return why("chart sum needs a number field");
        if (b.by === "month") return DATES.includes(field(c, b.dateField)?.type as FieldType) || why("chart by month needs a date field");
        return field(c, b.by)?.type === "select" || why("chart needs a select field or month");
      }
      case "stats":
        return (
          b.stats.every((s) => s.op === "count" || NUMERIC.includes(field(c, s.field)?.type as FieldType)) || why("sum/average needs a number field")
        );
      case "table":
      case "cards":
        return true;
    }
  });
  if (!blocks.length) problems.push("No usable blocks left");
  return { spec: { collections, blocks }, problems };
}

/** Parse anything (AI output, stored JSON) into a usable page draft, or null with the reasons. */
export function parsePageDraft(raw: unknown): { draft: PageDraft | null; problems: string[] } {
  const r = pageDraftSchema.safeParse(raw);
  if (!r.success) return { draft: null, problems: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) };
  const { spec, problems } = checkSpec(r.data.spec);
  return spec.blocks.length ? { draft: { ...r.data, spec }, problems } : { draft: null, problems };
}

// ── Item values ──

export type ItemData = Record<string, string | number | boolean | null>;

/** One form value → the stored value for that field type (invalid values become null). */
export function coerceValue(f: Field, raw: FormDataEntryValue | null): string | number | boolean | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  switch (f.type) {
    case "checkbox":
      return raw === "on" || raw === "true";
    case "number":
    case "money":
    case "rating": {
      if (!s) return null;
      const n = Number(s.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return f.type === "rating" ? Math.min(5, Math.max(0, Math.round(n))) : Math.round(n * 100) / 100;
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    case "datetime":
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : null;
    case "select":
      return f.options?.includes(s) ? s : null;
    case "url":
      return /^https?:\/\/\S+$/i.test(s) ? s.slice(0, 500) : null;
    case "longtext":
      return s.slice(0, 5000) || null;
    default:
      return s.slice(0, 300) || null;
  }
}

/** Shown in lists and cards. */
export function formatValue(f: Field, v: ItemData[string] | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  switch (f.type) {
    case "checkbox":
      return v ? "Yes" : "No";
    case "money":
      return `${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 2 })}${f.unit ? ` ${f.unit}` : ""}`;
    case "number":
      return `${v}${f.unit ? ` ${f.unit}` : ""}`;
    case "rating":
      return "★".repeat(Number(v)) + "☆".repeat(5 - Number(v));
    case "date":
      return new Date(`${v}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    case "datetime":
      return new Date(`${v}:00Z`).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    default:
      return String(v);
  }
}

/** The value a stat block shows. `today` is yyyy-mm-dd; "month" uses the collection's first date field. */
export function computeStat(c: Collection, items: ItemData[], s: z.infer<typeof stat>, today: string) {
  const dateField = c.fields.find((f) => DATES.includes(f.type));
  let list = items;
  if (s.where) list = list.filter((d) => String(d[s.where!.field] ?? "") === s.where!.value);
  if (s.period === "month" && dateField) list = list.filter((d) => String(d[dateField.key] ?? "").slice(0, 7) === today.slice(0, 7));
  if (s.op === "count") return list.length;
  const nums = list.map((d) => Number(d[s.field!])).filter((n) => Number.isFinite(n));
  const sum = nums.reduce((a, b) => a + b, 0);
  return s.op === "sum" ? sum : nums.length ? sum / nums.length : 0;
}

/** Chart series: per month (last 6, oldest first) or per select option. */
export function chartData(c: Collection, items: ItemData[], b: Extract<Block, { type: "chart" }>, today: string) {
  const value = (list: ItemData[]) => (b.op === "count" ? list.length : list.reduce((n, d) => n + (Number(d[b.field!]) || 0), 0));
  if (b.by === "month") {
    const months: string[] = [];
    const [y, m] = today.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    return {
      labels: months.map((mo) => new Date(`${mo}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })),
      values: months.map((mo) => value(items.filter((d) => String(d[b.dateField!] ?? "").slice(0, 7) === mo))),
    };
  }
  const f = c.fields.find((x) => x.key === b.by)!;
  const opts = f.options ?? [];
  return { labels: opts, values: opts.map((o) => value(items.filter((d) => d[b.by] === o))) };
}
