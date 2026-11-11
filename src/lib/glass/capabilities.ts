// Picks a rendering tier from what the browser can actually do.
//
// Tier 1: SVG refraction inside backdrop-filter (Chromium only), plus everything in Tier 2.
// Tier 2: backdrop-filter blur and saturation with layered highlights (Safari, Firefox, others).
// Tier 3: steady, nearly opaque surfaces with clear borders (no backdrop-filter, reduced
//         transparency or more contrast requested, or a very weak device).

export type GlassTier = 1 | 2 | 3;
export type TierReport = { tier: GlassTier; reasons: string[] };

type NavigatorExtras = Navigator & {
  userAgentData?: { brands?: { brand: string }[] };
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

export function detectTier(): TierReport {
  if (typeof window === "undefined") return { tier: 2, reasons: ["server render"] };
  const reasons: string[] = [];
  const mq = (q: string) => window.matchMedia(q).matches;
  const nav = navigator as NavigatorExtras;

  const hasBackdrop = CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)");
  if (!hasBackdrop) reasons.push("no backdrop-filter");
  if (mq("(prefers-reduced-transparency: reduce)")) reasons.push("reduced transparency requested");
  if (mq("(prefers-contrast: more)")) reasons.push("more contrast requested");
  const weak = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 1;
  if (weak) reasons.push("very low-power device");
  if (reasons.length) return { tier: 3, reasons };

  // Chromium is the only engine that applies SVG filters inside backdrop-filter today.
  const chromium = Boolean(nav.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand)));
  const svgBackdrop = CSS.supports("backdrop-filter", "url(#a)");
  if (!chromium) reasons.push("SVG backdrop refraction is Chromium-only");
  else if (!svgBackdrop) reasons.push("backdrop-filter url() unsupported");
  if (nav.connection?.saveData) reasons.push("data saver on");
  if ((nav.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) <= 2) reasons.push("low-power device");
  if (reasons.length) return { tier: 2, reasons };
  return { tier: 1, reasons: ["Chromium with SVG backdrop filters"] };
}

/** Median frame time over ~1 s, measured once (no lasting loop). */
export function probeFrameTime(frames = 60): Promise<number> {
  return new Promise((resolve) => {
    const times: number[] = [];
    let last = performance.now();
    const tick = (now: number) => {
      times.push(now - last);
      last = now;
      if (times.length < frames) requestAnimationFrame(tick);
      else {
        times.sort((a, b) => a - b);
        resolve(times[Math.floor(times.length / 2)]);
      }
    };
    requestAnimationFrame(tick);
  });
}
