import type { Collection, Field as FieldSpec, ItemData } from "@/lib/custom-pages";
import { Submit } from "../submit";
import { Field } from "../ui";

function Input({ f, value }: { f: FieldSpec; value: ItemData[string] | undefined }) {
  const v = value ?? "";
  switch (f.type) {
    case "longtext":
      return <textarea name={f.key} rows={4} maxLength={5000} defaultValue={String(v)} className="field" />;
    case "number":
    case "money":
      return <input name={f.key} inputMode="decimal" defaultValue={v === "" ? "" : String(v)} className="field" placeholder={f.unit ?? ""} />;
    case "rating":
      return (
        <select name={f.key} defaultValue={String(v)} className="field">
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </select>
      );
    case "date":
      return <input type="date" name={f.key} defaultValue={String(v)} className="field" />;
    case "datetime":
      return <input type="datetime-local" name={f.key} defaultValue={String(v)} className="field" />;
    case "select":
      return (
        <select name={f.key} defaultValue={String(v)} className="field">
          <option value="">—</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <label className="flex h-10 items-center gap-2 text-[15px]">
          {/* Marks the field as on the form, so an unticked box saves as "no". */}
          <input type="hidden" name={`present:${f.key}`} value="1" />
          <input type="checkbox" name={f.key} defaultChecked={Boolean(value)} className="size-5 accent-[var(--accent)]" />
          {f.label}
        </label>
      );
    case "url":
      return <input type="url" name={f.key} defaultValue={String(v)} className="field" placeholder="https://" />;
    default:
      return <input name={f.key} maxLength={300} defaultValue={String(v)} className="field" />;
  }
}

/** A form built from a collection's fields; the title field comes first and is required. */
export function ItemForm({ collection, action, data, submitLabel }: { collection: Collection; action: (fd: FormData) => Promise<void>; data?: ItemData; submitLabel: string }) {
  const fields = [...collection.fields].sort((a, b) => (a.key === collection.titleField ? -1 : b.key === collection.titleField ? 1 : 0));
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.type === "longtext" || f.key === collection.titleField ? "sm:col-span-2" : undefined}>
            {f.type === "checkbox" ? (
              <Input f={f} value={data?.[f.key]} />
            ) : (
              <Field label={`${f.label}${f.unit && f.type !== "number" && f.type !== "money" ? "" : f.unit ? ` (${f.unit})` : ""}`}>
                {f.key === collection.titleField ? <input name={f.key} required maxLength={300} defaultValue={String(data?.[f.key] ?? "")} className="field" autoFocus /> : <Input f={f} value={data?.[f.key]} />}
              </Field>
            )}
          </div>
        ))}
      </div>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}
