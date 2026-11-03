"use client";
import { useEffect, useState } from "react";

/** Text that types itself in, letter by letter, when it appears or changes (instant with reduced motion). */
export function TypeIn({ text, speed = 28 }: { text: string; speed?: number }) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(text.length);
    setN(0);
    let k = 0;
    const id = window.setInterval(() => {
      k += 1;
      setN(k);
      if (k >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <span aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span aria-hidden className="opacity-0">{text.slice(n)}</span>
    </span>
  );
}
