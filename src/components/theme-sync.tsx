"use client";
import { useEffect } from "react";
import { applyTheme, type ThemePref } from "@/lib/theme";

/** Keeps this device's copy of the theme in step with the one saved in Settings (e.g. after a new sign-in). */
export function ThemeSync({ theme }: { theme: ThemePref }) {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {}
    if (stored !== theme) applyTheme(theme);
  }, [theme]);
  return null;
}
