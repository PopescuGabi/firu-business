"use client";
// Optional debug panel: open with ?glassdebug=1 in the address bar (remembered for the tab).
import { useEffect, useState } from "react";
import type { GlassTier } from "@/lib/glass/capabilities";
import type { GlassMode } from "@/lib/glass/theme";
import { useGlass, useGlassStats } from "./engine";

function useFps(on: boolean) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!on) return;
    let frames = 0;
    let start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      if (now - start >= 1000) {
        setFps(Math.round((frames * 1000) / (now - start)));
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf); // the loop only runs while the panel is open
  }, [on]);
  return fps;
}

export function GlassDebug({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    try {
      const want = new URLSearchParams(location.search).get("glassdebug");
      if (want === "1") sessionStorage.setItem("glassdebug", "1");
      if (want === "0") sessionStorage.removeItem("glassdebug");
      if (sessionStorage.getItem("glassdebug") === "1") setOpen(true);
    } catch {
      /* storage blocked: the panel just stays closed */
    }
  }, []);
  const { tier, reasons, mode, setMode, forceTier } = useGlass();
  const s = useGlassStats();
  const fps = useFps(open);
  if (!open) return null;
  return (
    <aside className="lg-debug" aria-label="Liquid Glass debug">
      <div className="lg-debug-row">
        <b>Liquid Glass</b>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close debug panel">×</button>
      </div>
      <dl>
        <dt>Tier</dt>
        <dd>{tier === 1 ? "1 · SVG refraction + CSS" : tier === 2 ? "2 · CSS blur and highlights" : "3 · solid fallback"}</dd>
        <dt>Why</dt>
        <dd>{reasons.join("; ")}</dd>
        <dt>Frame rate</dt>
        <dd>{fps ? `${fps} fps` : "measuring…"}</dd>
        <dt>GPU time</dt>
        <dd>Not measurable: the browser composites SVG backdrop filters without timer queries</dd>
        <dt>Surfaces</dt>
        <dd>{s.surfaces}</dd>
        <dt>Errors</dt>
        <dd>{s.errors.length ? s.errors.join("; ") : "none"}</dd>
      </dl>
      <div className="lg-debug-row">
        {(["subtle", "balanced", "expressive"] as GlassMode[]).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="lg-debug-row">
        {([1, 2, 3] as GlassTier[]).map((t) => (
          <button key={t} type="button" aria-pressed={tier === t} onClick={() => forceTier(t)}>
            Tier {t}
          </button>
        ))}
        <button type="button" onClick={() => forceTier(null)}>Auto</button>
      </div>
    </aside>
  );
}
