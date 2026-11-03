"use client";
import { useEffect } from "react";
import { play, setSoundsEnabled } from "@/lib/sfx";

const CONTROL = 'button, a[href], [role="radio"], [role="tab"], [role="switch"], input[type="checkbox"], input[type="radio"], summary';

/**
 * One listener for the whole app: a soft tap on buttons, a swish on links, a tick on toggles,
 * a low tone on delete buttons. Liquid buttons play their own chime when they finish.
 */
export function SoundEffects({ on }: { on: boolean }) {
  useEffect(() => {
    setSoundsEnabled(on);
  }, [on]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(CONTROL);
      if (!el || el.matches(":disabled, [aria-disabled='true']")) return;
      const role = el.getAttribute("role");
      if (role === "radio" || role === "tab" || role === "switch" || el.matches("input")) play("toggle");
      else if (el.dataset.sfx === "remove" || el.className.includes("text-red")) play("remove");
      else if (el.matches("a[href]")) play("nav");
      else play("tap");
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);
  return null;
}
