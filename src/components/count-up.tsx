"use client";
import { useEffect, useRef, useState } from "react";

/** Minutes as hours and minutes: 2454 → "40h 54m", 45 → "45m". */
const hoursMinutes = (min: number) => {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  return h ? `${h}h ${total % 60}m` : `${total}m`;
};

/**
 * A number that counts up from zero when it first appears (straight to the value with reduced motion).
 * With `minutes`, the value is a number of minutes shown as hours and minutes.
 */
export function CountUp({ value, minutes = false, duration = 900 }: { value: number; minutes?: boolean; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(begin + (value - begin) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className="tabular-nums">
      {minutes ? hoursMinutes(shown) : Math.round(shown)}
    </span>
  );
}
