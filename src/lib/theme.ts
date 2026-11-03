// Light / dark / auto (follows the device). The choice is saved in Settings and mirrored in
// localStorage so the script below can paint the right colours before the page shows.

export type ThemePref = "auto" | "light" | "dark";
export const THEMES: { key: ThemePref; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];
export const isTheme = (t: string): t is ThemePref => THEMES.some((x) => x.key === t);

/** Runs in <head> before anything paints: sets html[data-theme] and follows the device in Auto. */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function p(){try{return localStorage.getItem("theme")||"auto"}catch(e){return"auto"}}function a(){var t=p();d.dataset.theme=t==="dark"||(t==="auto"&&m.matches)?"dark":"light"}a();m.addEventListener("change",a);window.__applyTheme=a}catch(e){}})()`;

/** Saves the choice for the next page load and applies it straight away (client only). */
export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem("theme", pref);
  } catch {}
  const apply = (window as unknown as { __applyTheme?: () => void }).__applyTheme;
  if (apply) apply();
  else document.documentElement.dataset.theme = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
