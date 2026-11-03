// App backgrounds a person can pick in Settings → Background (or "photo": their own upload).
// Each is a light and a dark CSS background for the fixed backdrop behind the glass.

const mesh = (base: string, ...blobs: [string, string][]) =>
  [...blobs.map(([at, color]) => `radial-gradient(55% 55% at ${at}, ${color}, transparent 72%)`), base].join(", ");

export const BACKGROUNDS = [
  { key: "default", label: "Soft", light: "", dark: "" }, // the built-in look in globals.css
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
