// Liquid Glass design tokens: one place for every optical, lighting and motion value.
// These are starting values tuned by eye, not physically calibrated material constants.

export type GlassMode = "subtle" | "balanced" | "expressive";

export interface GlassOptics {
  /** How far (as a share of the surface's smaller side) edge pixels are pulled toward the centre. */
  refractionStrength: number;
  /** Frost behind the glass, in CSS px. */
  blurRadius: number;
  /** Width of the curved rim, as a share of half the smaller side (0 = flat slab, 1 = fully domed). */
  surfaceThickness: number;
  /** How sharply the bend is concentrated at the very edge (0 = gentle, 1 = hard lip). */
  edgeDistortion: number;
  /** Red/blue split at the rim, in px. Off by default: it costs two extra filter passes. */
  chromaticAberration: number;
  /** Opacity of the tint laid over the backdrop (higher = more opaque, more legible). */
  transparency: number;
  /** Colour boost of what shows through (1 = unchanged). */
  saturation: number;
}

export interface GlassLighting {
  highlightIntensity: number;
  edgeBrightness: number;
  shadowStrength: number;
  /** The soft highlight follows the pointer while it is over an interactive surface. */
  dynamicLighting: boolean;
}

export interface GlassMotion {
  springStiffness: number;
  springDamping: number;
  hoverScale: number;
  pressScale: number;
  /** Upper bound for morphs (s); the spring decides the real length. */
  morphDuration: number;
}

export interface GlassPerformance {
  /** Probe frame times after start-up and drop to CSS-only glass when the device struggles. */
  adaptiveQuality: boolean;
  reducedMotionSupport: boolean;
  /** Lower-resolution refraction maps and no chromatic aberration on small screens. */
  mobileOptimization: boolean;
}

export interface GlassTheme {
  mode: GlassMode;
  optics: GlassOptics;
  lighting: GlassLighting;
  motion: GlassMotion;
  performance: GlassPerformance;
}

type ModeValues = Pick<GlassTheme, "optics" | "lighting" | "motion">;

export const GLASS_MODES: Record<GlassMode, ModeValues> = {
  subtle: {
    optics: { refractionStrength: 0.32, blurRadius: 12, surfaceThickness: 0.38, edgeDistortion: 0.2, chromaticAberration: 0, transparency: 0.56, saturation: 1.2 },
    lighting: { highlightIntensity: 0.22, edgeBrightness: 0.2, shadowStrength: 0.12, dynamicLighting: false },
    motion: { springStiffness: 300, springDamping: 30, hoverScale: 1.008, pressScale: 0.985, morphDuration: 0.3 },
  },
  balanced: {
    optics: { refractionStrength: 0.62, blurRadius: 6, surfaceThickness: 0.52, edgeDistortion: 0.15, chromaticAberration: 0, transparency: 0.4, saturation: 1.4 },
    lighting: { highlightIntensity: 0.35, edgeBrightness: 0.28, shadowStrength: 0.18, dynamicLighting: true },
    motion: { springStiffness: 260, springDamping: 26, hoverScale: 1.015, pressScale: 0.98, morphDuration: 0.35 },
  },
  expressive: {
    optics: { refractionStrength: 0.9, blurRadius: 3, surfaceThickness: 0.62, edgeDistortion: 0.1, chromaticAberration: 1.5, transparency: 0.26, saturation: 1.55 },
    lighting: { highlightIntensity: 0.5, edgeBrightness: 0.38, shadowStrength: 0.22, dynamicLighting: true },
    motion: { springStiffness: 220, springDamping: 20, hoverScale: 1.025, pressScale: 0.97, morphDuration: 0.45 },
  },
};

export const liquidGlassTheme: GlassTheme = {
  mode: "balanced",
  ...GLASS_MODES.balanced,
  performance: { adaptiveQuality: true, reducedMotionSupport: true, mobileOptimization: true },
};

export type GlassOverrides = Partial<{
  optics: Partial<GlassOptics>;
  lighting: Partial<GlassLighting>;
  motion: Partial<GlassMotion>;
}>;

/** The values for one surface: the global theme, then its mode, then its own overrides. */
export function resolveGlass(base: GlassTheme, mode?: GlassMode, overrides?: GlassOverrides): GlassTheme {
  const m = mode ? GLASS_MODES[mode] : base;
  return {
    ...base,
    mode: mode ?? base.mode,
    optics: { ...m.optics, ...overrides?.optics },
    lighting: { ...m.lighting, ...overrides?.lighting },
    motion: { ...m.motion, ...overrides?.motion },
  };
}
