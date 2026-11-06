"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ChevronDown, Plus } from "lucide-react";
import { addTemplatePages } from "@/app/actions/setup";
import { parsePageDraft } from "@/lib/custom-pages";
import { MODULES } from "@/lib/modules";
import { TEMPLATE_GROUPS, templateKey } from "@/lib/page-templates";
import { PageBlocks } from "./custom/blocks";
import { iconFor } from "./custom/icons";
import { LiquidButton, type LiquidState } from "./liquid-button";
import { buttonClass } from "./ui";

const sectionNames = (keys: string[]) => keys.map((k) => MODULES.find((m) => m.key === k)?.label ?? k).join(", ");

/** Ready-made pages by kind of job: pick a job, tick its pages (with a real preview), add them. */
export function TemplatePicker({ today, existing = [] }: { today: string; existing?: string[] }) {
  const [group, setGroup] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<LiquidState>("idle");
  const [result, setResult] = useState<{ added: number; href: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const g = TEMPLATE_GROUPS.find((x) => x.key === group);

  function open(key: string) {
    const next = group === key ? null : key;
    setGroup(next);
    setResult(null);
    const pages = TEMPLATE_GROUPS.find((x) => x.key === next)?.pages ?? [];
    setPicked(pages.map((_, i) => templateKey(next!, i)));
    setPreview(null);
  }

  async function add() {
    setState("busy");
    setError(null);
    try {
      const r = await addTemplatePages(picked);
      setResult(r);
      setState("done");
      window.setTimeout(() => setState("idle"), 1600);
    } catch {
      setError("Couldn't add these pages. Try again.");
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {TEMPLATE_GROUPS.map((t) => {
          const Icon = iconFor(t.icon);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => open(t.key)}
              aria-expanded={group === t.key}
              className={clsx("glass flex cursor-pointer items-start gap-3 rounded-[24px] p-4 text-left transition", group === t.key ? "ring-2 ring-[var(--accent)]" : "hover:-translate-y-0.5")}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-fill text-label-2">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{t.label}</span>
                <span className="block text-[13px] text-label-2">{t.description}</span>
                <span className="mt-1 block text-[12px] text-label-3">
                  {t.pages.length} pages{t.modules.length ? ` · goes well with ${sectionNames(t.modules)}` : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {g && (
        <div className="glass flex flex-col gap-2 rounded-[24px] p-3">
          {g.pages.map((raw, i) => {
            const key = templateKey(g.key, i);
            const { draft } = parsePageDraft(raw);
            if (!draft) return null;
            const Icon = iconFor(draft.icon);
            const on = picked.includes(key);
            const dup = existing.includes(draft.title);
            return (
              <div key={key} className="flex flex-col gap-2 rounded-[18px] bg-fill/60 p-2.5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`Add ${draft.title}`}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== key) : [...p, key]))}
                    className={clsx("grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition", on ? "border-accent bg-accent text-white" : "border-label-3")}
                  >
                    {on && <Check size={13} strokeWidth={3} />}
                  </button>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: draft.color }}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{draft.title}</p>
                    <p className="truncate text-[12px] text-label-2">
                      {draft.description}
                      {dup && " · you already have a page with this name"}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPreview(preview === key ? null : key)} aria-expanded={preview === key} className={buttonClass("gray", "sm")}>
                    Preview <ChevronDown size={13} className={clsx("transition", preview === key && "rotate-180")} />
                  </button>
                </div>
                {preview === key && (
                  <div className="pointer-events-none rounded-[16px] p-2 select-none">
                    <PageBlocks pageId={0} spec={draft.spec} items={[]} today={today} preview />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {result && (
              <span className="mr-auto text-[13px] text-green">
                Added {result.added} page{result.added === 1 ? "" : "s"}.{" "}
                {result.href && (
                  <Link href={result.href} className="font-semibold text-accent">
                    Open
                  </Link>
                )}
              </span>
            )}
            {error && <span role="alert" className="mr-auto text-[13px] text-red">{error}</span>}
            <LiquidButton
              size="sm"
              state={state}
              disabled={state === "busy" || !picked.length}
              onClick={add}
              icon={<Plus size={14} />}
              label={`Add ${picked.length} page${picked.length === 1 ? "" : "s"}`}
              busyLabel="Adding…"
              doneLabel="Added"
            />
          </div>
        </div>
      )}
    </div>
  );
}
