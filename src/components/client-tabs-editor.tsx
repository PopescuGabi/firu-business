"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Hammer, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { addClientStarterTab, setClientTabs } from "@/app/actions/client-tabs";
import { deletePage } from "@/app/actions/custom-pages";
import { PageBuilder } from "./page-builder";
import { Sheet } from "./sheet";
import { buttonClass } from "./ui";

type Builtin = { key: string; label: string; hint: string; tool?: string; needs?: string };

const STARTER_LABELS: Record<string, { label: string; hint: string }> = {
  notes: { label: "Notes", hint: "Meetings, ideas and anything to remember" },
  links: { label: "Links", hint: "Shared folders, tools and references" },
  checklist: { label: "Checklist", hint: "Things to do or check for this client" },
  tracker: { label: "Tracker", hint: "Anything with a status and a date" },
};

/**
 * "Edit tabs" on a client page: switch tabs on or off, put them in order, and add tabs of your own (a starter,
 * a ready-made page, or one you build). Every change saves straight away; each client keeps its own list.
 */
export function ClientTabsEditor({
  clientId,
  tabs,
  builtins,
  pages,
  starters,
  templates,
  today,
}: {
  clientId: number;
  tabs: string[];
  builtins: Builtin[];
  pages: { id: number; title: string }[];
  starters: string[];
  templates: { key: string; title: string; group: string }[];
  today: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [template, setTemplate] = useState("");

  const labelOf = (key: string) => builtins.find((b) => b.key === key)?.label ?? pages.find((p) => `page:${p.id}` === key)?.title ?? key;
  const save = (next: string[]) =>
    start(async () => {
      setError(null);
      await setClientTabs(clientId, next);
      router.refresh();
    });
  const move = (key: string, dir: -1 | 1) => {
    const out = [...tabs];
    const i = out.indexOf(key);
    const j = i + dir;
    if (i <= 0 || j <= 0 || j >= out.length) return;
    [out[i], out[j]] = [out[j], out[i]];
    save(out);
  };
  const remove = (key: string) => {
    // Brand profile works with Content: turning Content off takes the profile tab with it.
    const dependants = builtins.filter((b) => b.needs && builtins.find((t) => t.key === key)?.tool === b.needs).map((b) => b.key);
    save(tabs.filter((k) => k !== key && !dependants.includes(k)));
  };
  const add = (key: string) => {
    const needs = builtins.find((b) => b.key === key)?.needs;
    const needKey = needs ? builtins.find((b) => b.tool === needs)?.key : undefined;
    save([...tabs, ...(needKey && !tabs.includes(needKey) ? [needKey] : []), key]);
  };
  const addOwn = (key: string) =>
    start(async () => {
      setError(null);
      const r = await addClientStarterTab(clientId, key);
      if (!r.ok) return setError(r.message);
      // Close the sheet and open the new tab.
      document.querySelector<HTMLDialogElement>("dialog[open]")?.close();
      router.push(r.href);
      router.refresh();
    });

  /** Deletes one of this client's own tabs and everything in it (built-in tabs can only be hidden). */
  const deleteOwn = (key: string) => {
    const pageId = Number(key.slice(5));
    if (!confirm(`Delete the "${labelOf(key)}" tab and everything in it? This can't be undone.`)) return;
    start(async () => {
      setError(null);
      document.querySelector<HTMLDialogElement>("dialog[open]")?.close();
      await deletePage(pageId); // goes back to the client's Overview
    });
  };
  const deleteButton = (key: string) => (
    <button type="button" aria-label={`Delete ${labelOf(key)}`} onClick={() => deleteOwn(key)} className="grid size-8 place-items-center rounded-full text-red hover:bg-red/10">
      <Trash2 size={15} />
    </button>
  );

  const hiddenBuiltins = builtins.filter((b) => !tabs.includes(b.key));
  const hiddenPages = pages.filter((p) => !tabs.includes(`page:${p.id}`));

  return (
    <Sheet title="Tabs for this client" trigger={<><SlidersHorizontal size={14} /> Edit tabs</>} triggerClassName={buttonClass("gray", "sm")}>
      {building ? (
        <div className="flex flex-col gap-4">
          <button type="button" className="self-start text-[14px] font-semibold text-accent" onClick={() => setBuilding(false)}>
            ← Back to tabs
          </button>
          <PageBuilder today={today} clientId={clientId} onDone={() => setBuilding(false)} />
        </div>
      ) : (
        <div className={clsx("flex flex-col gap-6", busy && "pointer-events-none opacity-70")}>
          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[12px] font-semibold tracking-wide text-label-2 uppercase">Shown, in this order</h3>
            <ul className="flex flex-col gap-1.5">
              {tabs.map((key, i) => (
                <li key={key} className="flex items-center gap-2 rounded-[14px] bg-well px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{labelOf(key)}</span>
                  {key === "overview" ? (
                    <span className="text-[12px] text-label-3">Always first</span>
                  ) : (
                    <>
                      <button type="button" aria-label={`Move ${labelOf(key)} left`} disabled={i <= 1} onClick={() => move(key, -1)} className="grid size-8 place-items-center rounded-full text-label-2 hover:bg-fill disabled:opacity-30">
                        <ArrowLeft size={15} />
                      </button>
                      <button type="button" aria-label={`Move ${labelOf(key)} right`} disabled={i >= tabs.length - 1} onClick={() => move(key, 1)} className="grid size-8 place-items-center rounded-full text-label-2 hover:bg-fill disabled:opacity-30">
                        <ArrowRight size={15} />
                      </button>
                      {key.startsWith("page:") && deleteButton(key)}
                      <input type="checkbox" role="switch" className="switch" checked onChange={() => remove(key)} aria-label={`Hide ${labelOf(key)}`} />
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="px-1 text-[12px] text-label-3">Turning off Instagram, Content, App or Finance also switches that tool off for this client. Hiding your own tab keeps what's in it; the bin deletes it.</p>
          </section>

          {(hiddenBuiltins.length > 0 || hiddenPages.length > 0) && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-[12px] font-semibold tracking-wide text-label-2 uppercase">Add a tab</h3>
              <ul className="flex flex-col gap-1.5">
                {[...hiddenBuiltins.map((b) => ({ key: b.key, label: b.label, hint: b.hint })), ...hiddenPages.map((p) => ({ key: `page:${p.id}`, label: p.title, hint: "Your own tab (hidden)" }))].map((t) => (
                  <li key={t.key} className="flex items-center gap-3 rounded-[14px] bg-well px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{t.label}</span>
                      <span className="block truncate text-[12px] text-label-2">{t.hint}</span>
                    </span>
                    {t.key.startsWith("page:") && deleteButton(t.key)}
                    <button type="button" onClick={() => add(t.key)} aria-label={`Add ${t.label}`} className="grid size-8 shrink-0 place-items-center rounded-full bg-fill hover:bg-ink hover:text-on-ink">
                      <Plus size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-[12px] font-semibold tracking-wide text-label-2 uppercase">A tab of your own</h3>
            <div className="grid grid-cols-2 gap-2">
              {starters.map((k) => (
                <button key={k} type="button" onClick={() => addOwn(k)} className="flex flex-col items-start gap-0.5 rounded-[14px] bg-well px-3 py-2.5 text-left hover:bg-fill">
                  <span className="text-[14px] font-medium">{STARTER_LABELS[k]?.label ?? k}</span>
                  <span className="text-[12px] text-label-2">{STARTER_LABELS[k]?.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className="field min-w-0 flex-1 text-[14px]" aria-label="Ready-made page">
                <option value="">Ready-made page…</option>
                {[...new Set(templates.map((t) => t.group))].map((g) => (
                  <optgroup key={g} label={g}>
                    {templates
                      .filter((t) => t.group === g)
                      .map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" disabled={!template} onClick={() => addOwn(template)} className={buttonClass("gray", "sm")}>
                <Plus size={14} /> Add
              </button>
            </div>
            <button type="button" onClick={() => setBuilding(true)} className={clsx(buttonClass("tinted", "sm"), "self-start")}>
              <Hammer size={14} /> Build your own
            </button>
            <p className="px-1 text-[12px] text-label-3">Each own tab has a Claude button to change it by describing what you need.</p>
          </section>
          {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
