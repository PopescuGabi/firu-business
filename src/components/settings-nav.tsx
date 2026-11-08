"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

/** Settings' section list on a computer: jumps to a section and follows along as you scroll. */
export function SettingsNav() {
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-settings] section[id][data-title]")];
    setItems(sections.map((el) => ({ id: el.id, label: el.dataset.title! })));
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = sections.find((el) => seen.get(el.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: "-10% 0px -55% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav aria-label="Settings sections" className="sticky top-6 hidden self-start lg:block">
      <ul className="flex flex-col gap-0.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              onClick={() => setCurrent(it.id)}
              className={clsx("block truncate rounded-[11px] px-3 py-1.5 text-[14px] transition", current === it.id ? "sel-pane font-semibold text-label" : "text-label-2 hover:bg-fill hover:text-label")}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
