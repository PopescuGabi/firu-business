"use client";
import clsx from "clsx";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass } from "./ui";

export type LiquidState = "idle" | "busy" | "done";

/**
 * A blue glass button that fills with liquid while its work runs (real progress when `progress`
 * is given, otherwise an easing guess), then shows ✓ and `doneLabel`, like the reference video.
 * `chip` puts the icon in a round chip at the end; `square` is the icon-only version that fills upward.
 */
export function LiquidButton({
  state = "idle",
  progress,
  label,
  busyLabel,
  doneLabel,
  icon,
  chip = false,
  square = false,
  size = "md",
  className,
  style,
  ...rest
}: Omit<ComponentProps<"button">, "children"> & {
  state?: LiquidState;
  progress?: number; // 0..1
  label: ReactNode;
  busyLabel?: ReactNode;
  doneLabel?: ReactNode;
  icon?: ReactNode;
  chip?: boolean;
  square?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const text = state === "busy" ? (busyLabel ?? label) : state === "done" ? (doneLabel ?? label) : label;
  const mark = state === "done" ? <Check size={size === "sm" ? 13 : 16} strokeWidth={2.6} /> : icon;
  return (
    <button
      {...rest}
      data-state={state}
      data-progress={progress != null ? "" : undefined}
      aria-busy={state === "busy" || undefined}
      className={clsx(buttonClass("filled", size), square ? "liquid-square aspect-square !px-0" : chip && "!pr-1", className)}
      style={{ ...style, ...(progress != null ? { ["--p" as string]: Math.max(0, Math.min(1, progress)) } : null) }}
    >
      <span className="liquid-fill" aria-hidden />
      {square ? (
        <span className="relative z-[1] grid place-items-center">{mark}</span>
      ) : (
        <>
          {!chip && mark && <span className="relative z-[1] grid place-items-center">{mark}</span>}
          <span className="relative z-[1]">{text}</span>
          {chip && <span className="liquid-chip">{mark}</span>}
        </>
      )}
    </button>
  );
}
