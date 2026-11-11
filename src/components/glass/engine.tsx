"use client";
// The Liquid Glass engine: picks a rendering tier once, shares the theme, and renders GlassSurface,
// the one element every glass component is built from.
import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";
import { detectTier, probeFrameTime, type GlassTier, type TierReport } from "@/lib/glass/capabilities";
import { refractionMap } from "@/lib/glass/displacement";
import { springCurve } from "@/lib/glass/spring";
import { liquidGlassTheme, resolveGlass, type GlassMode, type GlassOverrides, type GlassTheme } from "@/lib/glass/theme";

/* ---------- stats for the debug panel (no React re-renders unless the panel is open) ---------- */

const stats = { surfaces: 0, errors: [] as string[], version: 0 };
const listeners = new Set<() => void>();
function bump() {
  stats.version++;
  listeners.forEach((l) => l());
}
export function reportGlassError(message: string) {
  if (stats.errors.length < 20) stats.errors.push(message);
  bump();
}
export function useGlassStats() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => stats.version,
    () => 0,
  );
  return stats;
}

/* ---------- provider ---------- */

type GlassContextValue = {
  theme: GlassTheme;
  tier: GlassTier;
  reasons: string[];
  mode: GlassMode;
  setMode: (m: GlassMode) => void;
  forceTier: (t: GlassTier | null) => void;
};

const GlassContext = createContext<GlassContextValue>({
  theme: liquidGlassTheme,
  tier: 2,
  reasons: ["no provider"],
  mode: liquidGlassTheme.mode,
  setMode: () => {},
  forceTier: () => {},
});

export const useGlass = () => useContext(GlassContext);

export function GlassProvider({ mode: initialMode = liquidGlassTheme.mode, children }: { mode?: GlassMode; children: ReactNode }) {
  const [mode, setMode] = useState<GlassMode>(initialMode);
  // The server and the first client render agree on Tier 2 (CSS only); the real tier follows.
  const [report, setReport] = useState<TierReport>({ tier: 2, reasons: ["starting"] });
  const [forced, setForced] = useState<GlassTier | null>(null);
  const theme = useMemo(() => resolveGlass(liquidGlassTheme, mode), [mode]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const r = detectTier();
      if (cancelled) return;
      setReport(r);
      if (r.tier === 1 && liquidGlassTheme.performance.adaptiveQuality) {
        // One short frame-time probe, then no further timing work.
        probeFrameTime().then((ms) => {
          if (!cancelled && ms > 26) setReport({ tier: 2, reasons: [...r.reasons, `slow frames (${ms.toFixed(0)} ms median), refraction off`] });
        });
      }
    };
    run();
    const queries = ["(prefers-reduced-transparency: reduce)", "(prefers-contrast: more)"].map((q) => window.matchMedia(q));
    queries.forEach((q) => q.addEventListener("change", run));
    return () => {
      cancelled = true;
      queries.forEach((q) => q.removeEventListener("change", run));
    };
  }, []);

  const tier = forced ?? report.tier;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.glassTier = String(tier);
    const spring = springCurve(theme.motion.springStiffness, theme.motion.springDamping, theme.motion.morphDuration * 2.5);
    root.style.setProperty("--lg-spring", spring.easing);
    root.style.setProperty("--lg-spring-ms", `${spring.duration}ms`);
  }, [tier, theme]);

  const value = useMemo(
    () => ({ theme, tier, reasons: forced ? [`forced to Tier ${forced}`] : report.reasons, mode, setMode, forceTier: setForced }),
    [theme, tier, report.reasons, forced, mode],
  );
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

/* ---------- the surface ---------- */

export type GlassShape = "rounded" | "capsule" | "circle";
export type GlassTint = "clear" | "accent" | "danger";

type OwnProps = {
  /** Override the global intensity for this surface. */
  mode?: GlassMode;
  overrides?: GlassOverrides;
  shape?: GlassShape;
  /** Corner radius in px for "rounded". */
  radius?: number;
  /** Hover lift, press squeeze and a highlight that follows the pointer. */
  interactive?: boolean;
  tint?: GlassTint;
  /** "high" lays a denser tint under text that must stay readable over busy backdrops. */
  contrast?: "auto" | "high";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export type GlassSurfaceProps<T extends ElementType> = OwnProps & { as?: T } & Omit<ComponentPropsWithRef<T>, keyof OwnProps | "as">;

function setRef<V>(ref: Ref<V> | undefined, value: V) {
  if (typeof ref === "function") ref(value);
  else if (ref && typeof ref === "object") (ref as { current: V }).current = value;
}

export function GlassSurface<T extends ElementType = "div">(props: GlassSurfaceProps<T>) {
  const { as, mode, overrides, shape = "rounded", radius = 24, interactive = false, tint = "clear", contrast = "auto", className, style, children, ...rest } = props;
  const forwardedRef = (rest as { ref?: Ref<HTMLElement> }).ref;
  delete (rest as { ref?: unknown }).ref;
  const Tag: ElementType = as ?? "div";
  const ctx = useGlass();
  const overridesKey = overrides ? JSON.stringify(overrides) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- overrides compared by value
  const g = useMemo(() => resolveGlass(ctx.theme, mode, overrides), [ctx.theme, mode, overridesKey]);
  const fid = "lg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const el = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const refract = ctx.tier === 1 && g.optics.refractionStrength > 0;

  useEffect(() => {
    stats.surfaces++;
    bump();
    return () => {
      stats.surfaces--;
      bump();
    };
  }, []);

  // Only Tier 1 needs the size (for its refraction map); rounded to 4 px so small jitters don't redraw.
  useEffect(() => {
    if (!refract || !el.current) return;
    const node = el.current;
    const apply = (rw: number, rh: number) => {
      const w = Math.round(rw / 4) * 4;
      const h = Math.round(rh / 4) * 4;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    // Measure once now, then follow changes (ResizeObserver delivers at most once per frame).
    apply(node.offsetWidth, node.offsetHeight);
    const ro = new ResizeObserver(([entry]) => {
      const b = entry.borderBoxSize?.[0];
      apply(b?.inlineSize ?? node.offsetWidth, b?.blockSize ?? node.offsetHeight);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [refract]);

  const r = shape === "rounded" ? radius : Math.min(size.w, size.h) / 2;
  const map = useMemo(() => {
    if (!refract || !size.w) return null;
    try {
      return refractionMap({ width: size.w, height: size.h, radius: r }, g.optics);
    } catch (e) {
      reportGlassError(`refraction map: ${(e as Error).message}`);
      return null;
    }
  }, [refract, size.w, size.h, r, g.optics]);

  const small = typeof window !== "undefined" && ctx.theme.performance.mobileOptimization && window.innerWidth < 600;
  const maxPull = Math.min(40, g.optics.refractionStrength * (Math.min(size.w, size.h) / 2)) * (small ? 0.8 : 1);
  const scale = Math.round(maxPull * 2);
  const ca = small ? 0 : g.optics.chromaticAberration;

  // Dynamic highlight: CSS variables updated at most once per frame while the pointer is over it.
  const frame = useRef(0);
  const onMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const node = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const b = node.getBoundingClientRect();
      node.style.setProperty("--lx", `${(((clientX - b.left) / b.width) * 100).toFixed(1)}%`);
      node.style.setProperty("--ly", `${(((clientY - b.top) / b.height) * 100).toFixed(1)}%`);
    });
  }, []);
  const onLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    cancelAnimationFrame(frame.current);
    e.currentTarget.style.removeProperty("--lx");
    e.currentTarget.style.removeProperty("--ly");
  }, []);
  const lighting = interactive && g.lighting.dynamicLighting;

  const vars = {
    "--lg-blur": `${g.optics.blurRadius}px`,
    "--lg-sat": g.optics.saturation,
    "--lg-tint": g.optics.transparency,
    "--lg-hi": g.lighting.highlightIntensity,
    "--lg-edge": g.lighting.edgeBrightness,
    "--lg-shadow": g.lighting.shadowStrength,
    "--lg-hover": g.motion.hoverScale,
    "--lg-press": g.motion.pressScale,
    "--lg-radius": shape === "rounded" ? `${radius}px` : "9999px",
  } as CSSProperties;
  if (map) {
    const f = `url(#${fid}) blur(${g.optics.blurRadius}px) saturate(${g.optics.saturation})`;
    vars.backdropFilter = f;
  }

  return (
    <Tag
      {...rest}
      ref={(node: HTMLElement | null) => {
        el.current = node;
        setRef(forwardedRef, node);
      }}
      className={clsx("lg", className)}
      data-shape={shape}
      data-tint={tint === "clear" ? undefined : tint}
      data-interactive={interactive ? "" : undefined}
      data-contrast={contrast === "high" ? "high" : undefined}
      data-refract={map ? "" : undefined}
      style={{ ...vars, ...style }}
      onPointerMove={lighting ? onMove : (rest as { onPointerMove?: unknown }).onPointerMove}
      onPointerLeave={lighting ? onLeave : (rest as { onPointerLeave?: unknown }).onPointerLeave}
    >
      {map && (
        <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute", pointerEvents: "none" }}>
          <filter id={fid} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
            {ca > 0 ? (
              <>
                <feDisplacementMap in="SourceGraphic" in2="map" scale={scale + ca * 2} xChannelSelector="R" yChannelSelector="G" result="dr" />
                <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="dg" />
                <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
                <feDisplacementMap in="SourceGraphic" in2="map" scale={Math.max(0, scale - ca * 2)} xChannelSelector="R" yChannelSelector="G" result="db" />
                <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
                <feBlend in="r" in2="g" mode="screen" result="rg" />
                <feBlend in="rg" in2="b" mode="screen" />
              </>
            ) : (
              <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
            )}
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
}
