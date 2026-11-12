// App backgrounds a person can pick in Settings → Background (or "photo": their own upload).
// Each is a light and a dark CSS background for the fixed backdrop behind the glass.

const mesh = (base: string, ...blobs: [string, string][]) =>
  [...blobs.map(([at, color]) => `radial-gradient(55% 55% at ${at}, ${color}, transparent 72%)`), base].join(", ");


/**
 * Silk: folded violet satin, drawn as an SVG. Each fold is a band with its own light-to-shadow gradient and
 * a hard crease against the next one, so the glass in front has real edges to bend (over a soft gradient,
 * refraction is invisible). Deterministic, painted once on the fixed backdrop.
 */
function silk(dark: boolean) {
  // Shadow, body, sheen and highlight of the cloth.
  const c = dark
    ? { deep: "#07040f", shade: "#1b0b47", body: "#4a22c4", sheen: "#8156ff", light: "#a98bff" }
    : { deep: "#3b1a9e", shade: "#5a2fe0", body: "#8a63ff", sheen: "#b9a0ff", light: "#f3ecff" };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const W = 2600;
  const defs: string[] = [];
  const bands: string[] = [];
  // Fold edges: wavy lines across a rotated frame; band k lies between edge k and edge k + 1.
  const edge = (y: number, a: number, ph: number) => {
    const p = (x: number) => `${x} ${Math.round(y + a * Math.sin(x / 520 + ph))}`;
    const pts = [-400, 100, 600, 1100, 1600, 2100, W].map(p);
    return pts;
  };
  let y = -260;
  let k = 0;
  let prev = edge(y, 40, 0.4);
  while (y < 1900) {
    const h = 46 + rnd() * rnd() * 330;
    y += h;
    const next = edge(y, 30 + rnd() * 60, rnd() * 6.28);
    const id = `f${k}`;
    // Where the light catches this fold, and how bright it gets.
    const peak = 0.25 + rnd() * 0.5;
    const bright = rnd();
    const top = bright > 0.72 ? c.light : bright > 0.35 ? c.sheen : c.body;
    const mid = bright > 0.72 ? c.sheen : bright > 0.35 ? c.body : c.shade;
    defs.push(
      `<linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='0' y1='${Math.round(y - h)}' x2='0' y2='${Math.round(y)}'>` +
        // A soft shoulder on one side and a hard crease on the other, like real cloth.
        `<stop offset='0' stop-color='${mid}'/>` +
        `<stop offset='${peak.toFixed(2)}' stop-color='${top}'/><stop offset='${Math.min(0.97, peak + 0.22).toFixed(2)}' stop-color='${mid}'/>` +
        `<stop offset='1' stop-color='${k % 3 === 0 ? c.deep : c.shade}'/></linearGradient>`,
    );
    bands.push(`<path fill='url(#${id})' d='M${prev.join(" L")} L${[...next].reverse().join(" L")}Z'/>`);
    prev = next;
    k++;
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1000' preserveAspectRatio='xMidYMid slice'>` +
    `<defs>${defs.join("")}<filter id='s' x='-5%' y='-5%' width='110%' height='110%'><feGaussianBlur stdDeviation='2.2'/></filter>` +
    `<radialGradient id='v' cx='.5' cy='.45' r='.8'><stop offset='.45' stop-color='${c.deep}' stop-opacity='0'/><stop offset='1' stop-color='${c.deep}' stop-opacity='${dark ? 0.75 : 0.35}'/></radialGradient></defs>` +
    `<rect width='1600' height='1000' fill='${c.deep}'/>` +
    `<g filter='url(#s)' transform='translate(-420 760) rotate(-34) scale(1.05)'>${bands.join("")}</g>` +
    `<rect width='1600' height='1000' fill='url(#v)'/></svg>`;
  const url = `url("data:image/svg+xml,${svg.replace(/%/g, "%25").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22").replace(/#/g, "%23")}") center / cover no-repeat`;
  return `${url}, ${c.deep}`;
}

export const BACKGROUNDS = [
  { key: "silk", label: "Silk", light: silk(false), dark: silk(true) }, // the Dashboard's own look: violet silk behind clear glass
  { key: "default", label: "Solid", light: "", dark: "" }, // the built-in look in globals.css: one solid colour (true black in dark)
  {
    key: "aurora",
    label: "Aurora",
    light: mesh("linear-gradient(160deg, #eceaff, #e3f3f0)", ["12% 8%", "rgba(139, 108, 255, 0.75)"], ["88% 18%", "rgba(80, 160, 255, 0.6)"], ["72% 92%", "rgba(40, 200, 160, 0.55)"], ["8% 88%", "rgba(244, 114, 182, 0.5)"]),
    dark: mesh("linear-gradient(160deg, #0d0b1c, #07120f)", ["12% 8%", "rgba(124, 92, 255, 0.55)"], ["88% 18%", "rgba(56, 130, 255, 0.4)"], ["72% 92%", "rgba(30, 180, 140, 0.38)"], ["8% 88%", "rgba(236, 72, 153, 0.3)"]),
  },
  {
    key: "sunset",
    label: "Sunset",
    light: mesh("linear-gradient(170deg, #fff1e6, #fde4ec)", ["15% 10%", "rgba(255, 150, 80, 0.7)"], ["85% 15%", "rgba(255, 90, 130, 0.55)"], ["75% 90%", "rgba(160, 90, 255, 0.5)"], ["10% 85%", "rgba(255, 200, 90, 0.6)"]),
    dark: mesh("linear-gradient(170deg, #1a0d0a, #170a16)", ["15% 10%", "rgba(255, 120, 50, 0.45)"], ["85% 15%", "rgba(255, 60, 110, 0.38)"], ["75% 90%", "rgba(140, 70, 255, 0.36)"], ["10% 85%", "rgba(255, 170, 60, 0.28)"]),
  },
  {
    key: "ocean",
    label: "Ocean",
    light: mesh("linear-gradient(170deg, #e6f3ff, #e2fbf8)", ["10% 12%", "rgba(40, 140, 255, 0.65)"], ["90% 10%", "rgba(90, 220, 255, 0.6)"], ["80% 88%", "rgba(20, 190, 170, 0.55)"], ["12% 90%", "rgba(110, 100, 255, 0.45)"]),
    dark: mesh("linear-gradient(170deg, #050d1c, #04141a)", ["10% 12%", "rgba(30, 110, 255, 0.5)"], ["90% 10%", "rgba(40, 190, 240, 0.35)"], ["80% 88%", "rgba(10, 160, 150, 0.38)"], ["12% 90%", "rgba(90, 80, 240, 0.32)"]),
  },
  {
    key: "forest",
    label: "Forest",
    light: mesh("linear-gradient(170deg, #eef7e8, #f7f2e2)", ["12% 10%", "rgba(80, 190, 110, 0.6)"], ["88% 14%", "rgba(200, 220, 80, 0.5)"], ["78% 90%", "rgba(30, 150, 120, 0.55)"], ["10% 88%", "rgba(240, 170, 70, 0.45)"]),
    dark: mesh("linear-gradient(170deg, #07120a, #12100a)", ["12% 10%", "rgba(60, 170, 90, 0.42)"], ["88% 14%", "rgba(170, 190, 50, 0.28)"], ["78% 90%", "rgba(20, 130, 100, 0.4)"], ["10% 88%", "rgba(220, 140, 40, 0.26)"]),
  },
  {
    key: "candy",
    label: "Candy",
    light: mesh("linear-gradient(170deg, #fdeefb, #eef0ff)", ["12% 10%", "rgba(255, 120, 200, 0.6)"], ["88% 12%", "rgba(255, 180, 140, 0.6)"], ["78% 90%", "rgba(150, 130, 255, 0.6)"], ["10% 88%", "rgba(110, 210, 255, 0.5)"]),
    dark: mesh("linear-gradient(170deg, #180a16, #0c0b1c)", ["12% 10%", "rgba(255, 80, 180, 0.4)"], ["88% 12%", "rgba(255, 140, 100, 0.3)"], ["78% 90%", "rgba(130, 100, 255, 0.42)"], ["10% 88%", "rgba(70, 170, 255, 0.3)"]),
  },
  {
    key: "graphite",
    label: "Graphite",
    light: mesh("linear-gradient(170deg, #f1f1f4, #e4e5ea)", ["15% 10%", "rgba(150, 155, 175, 0.5)"], ["85% 90%", "rgba(120, 125, 150, 0.45)"]),
    dark: mesh("linear-gradient(170deg, #111114, #08080a)", ["15% 10%", "rgba(120, 125, 150, 0.28)"], ["85% 90%", "rgba(90, 95, 120, 0.26)"]),
  },
] as const;

export type BackgroundKey = (typeof BACKGROUNDS)[number]["key"] | "photo";

export const isBackground = (k: string): k is BackgroundKey => k === "photo" || BACKGROUNDS.some((b) => b.key === k);

/** A soft veil over a photo so text stays readable, in light and dark. */
export function photoBackdrop(url: string) {
  const photo = `url("${url}") center / cover no-repeat`;
  return {
    light: `linear-gradient(rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.14)), ${photo}, #efedf3`,
    dark: `linear-gradient(rgba(8, 7, 12, 0.38), rgba(8, 7, 12, 0.38)), ${photo}, #0d0c11`,
  };
}

/** CSS that swaps the backdrop colours (a <style> after globals.css). */
export const backdropCss = ({ light, dark }: { light: string; dark: string }) =>
  light ? `:root{--backdrop:${light}}:root[data-theme="dark"]{--backdrop:${dark}}` : "";
