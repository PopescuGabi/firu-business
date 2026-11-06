"use client";
// The AI video template: renders a VideoSpec (src/lib/video/spec.ts) as a 1080×1920 reel.
// Built only from CSS that Remotion's in-browser renderer can draw (linear gradients, transforms, opacity,
// clip-path inset, blur, basic box-shadow): no radial gradients, backdrop-filter, inset shadows or color-mix.
// Brain rules baked into the layout: text in Meta's safe box (x 65–1015, y 269–1248), readable sizes
// (≥ 46 px, hooks 88+ px, captions B14), one onset at a time, ease-out entrances, subject in frame 0.
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video } from "@remotion/media";
import { FPS, type Attachment, type Scene, type VideoSpec } from "@/lib/video/spec";

const OUT = Easing.bezier(0.05, 0.7, 0.1, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number, a: number, b: number, e = OUT) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: e });
const spr = (t: number, at: number, damping = 18, stiffness = 120) => spring({ frame: Math.round((t - at) * FPS), fps: FPS, config: { damping, stiffness } });
const OVERLAP = 0.5; // seconds the outgoing scene stays while the next one enters

const FONT_STACKS: Record<VideoSpec["theme"]["font"], string> = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  serif: 'Georgia, "Times New Roman", "Iowan Old Style", serif',
  rounded: '"SF Pro Rounded", ui-rounded, "Nunito", "Varela Round", -apple-system, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

type Palette = { bg: string; text: string; sub: string; card: string; cardText: string; onAccent: string; shadow: string; captionBg: string; captionText: string };
function palette(spec: VideoSpec): Palette {
  const { look, accent } = spec.theme;
  if (look === "dark")
    return { bg: "linear-gradient(160deg, #0d0f14 0%, #151a26 60%, #0b0d12 100%)", text: "#f5f6f8", sub: "rgba(235,238,245,0.66)", card: "rgba(255,255,255,0.08)", cardText: "#f5f6f8", onAccent: "#ffffff", shadow: "0 30px 80px rgba(0,0,0,0.45)", captionBg: "rgba(0,0,0,0.6)", captionText: "#ffffff" };
  if (look === "bold")
    return { bg: `linear-gradient(160deg, ${accent} 0%, ${shade(accent, -0.35)} 100%)`, text: "#ffffff", sub: "rgba(255,255,255,0.78)", card: "rgba(255,255,255,0.16)", cardText: "#ffffff", onAccent: accent, shadow: "0 30px 80px rgba(0,0,0,0.25)", captionBg: "rgba(0,0,0,0.45)", captionText: "#ffffff" };
  if (look === "soft")
    return { bg: `linear-gradient(165deg, ${tint(accent, 0.86)} 0%, ${tint(spec.theme.accent2, 0.88)} 100%)`, text: "#14161c", sub: "rgba(20,22,28,0.6)", card: "rgba(255,255,255,0.78)", cardText: "#14161c", onAccent: "#ffffff", shadow: "0 24px 60px rgba(20,24,40,0.12)", captionBg: "rgba(255,255,255,0.88)", captionText: "#14161c" };
  return { bg: "linear-gradient(180deg, #f6f7fa 0%, #e8ebf1 100%)", text: "#0f1115", sub: "rgba(30,34,44,0.6)", card: "rgba(255,255,255,0.9)", cardText: "#0f1115", onAccent: "#ffffff", shadow: "0 24px 60px rgba(16,20,40,0.12)", captionBg: "rgba(15,17,21,0.78)", captionText: "#ffffff" };
}
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const tint = (hex: string, k: number) => toHex(rgb(hex).map((v) => v + (255 - v) * k));
const shade = (hex: string, k: number) => toHex(rgb(hex).map((v) => v * (1 + k)));
const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export type Timeline = { start: number; end: number }[];
export function timeline(spec: VideoSpec): Timeline {
  let t = 0;
  return spec.scenes.map((s) => {
    const r = { start: t, end: t + s.duration };
    t += s.duration;
    return r;
  });
}

/** Title with one accented word/phrase (by meaning, never decoration). Words rise one after another. */
const Title: React.FC<{ text: string; emphasis: string; size: number; t: number; at: number; color: string; accent: string; font: string; weight?: number; instant?: boolean; align?: "left" | "center"; underline?: boolean }> = ({ text, emphasis, size, t, at, color, accent, font, weight = 800, instant, align = "left", underline }) => {
  const words = text.split(/\s+/).filter(Boolean);
  const emph = emphasis.toLowerCase().split(/\s+/).filter(Boolean);
  let idx = 0;
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, lineHeight: 1.04, letterSpacing: -size * 0.025, color, textAlign: align, textShadow: color === "#ffffff" ? "0 3px 24px rgba(0,0,0,0.45)" : undefined }}>
      {words.map((w, i) => {
        const clean = w.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, "");
        const isEm = emph.length > 0 && emph.some((e) => e.replace(/[^\p{L}\p{N}%]/gu, "") === clean);
        const p = instant ? 1 : spr(t, at + idx++ * 0.06, 16, 160);
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.24, color: isEm && !underline ? accent : color, textDecoration: isEm && underline ? "underline" : undefined, textDecorationColor: accent, textDecorationThickness: Math.round(size * 0.09), opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * size * 0.45}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Caption band in the lower safe zone (y ≈ 1030–1230): phrase chunks shown one after another across the scene. */
const CaptionBand: React.FC<{ text: string; t: number; duration: number; pal: Palette; font: string }> = ({ text, t, duration, pal, font }) => {
  const chunks = chunk(text, 34);
  if (!chunks.length) return null;
  const per = duration / chunks.length;
  const i = Math.min(chunks.length - 1, Math.floor(t / per));
  const local = t - i * per;
  const p = ease(local, 0, 0.18);
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 1050, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 900, padding: "18px 30px", borderRadius: 26, background: pal.captionBg, color: pal.captionText, fontFamily: font, fontSize: 50, fontWeight: 650, lineHeight: 1.18, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>{chunks[i]}</div>
    </div>
  );
};
/** Phrase chunks of balanced length (no orphan words), breaking after punctuation when possible. */
function chunk(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const n = Math.max(1, Math.ceil(text.length / max));
  const target = text.length / n;
  const out: string[] = [];
  let cur = "";
  for (let k = 0; k < words.length; k++) {
    const w = words[k];
    const next = (cur + " " + w).trim();
    const left = words.length - k;
    if (cur && out.length < n - 1 && next.length > target + 4 && left > 1) {
      out.push(cur);
      cur = w;
    } else cur = next;
    if (/[.!?;:,]$/.test(w) && cur.length >= target * 0.7 && out.length < n - 1 && k < words.length - 2) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

const MediaLayer: React.FC<{ a: Attachment; scene: Scene; t: number; dim: number }> = ({ a, scene, t, dim }) => {
  const m = scene.media!;
  const k = ease(t, 0, scene.duration + OVERLAP, (x) => x);
  const zoom = m.move === "in" ? 1.04 + 0.08 * k : m.move === "out" ? 1.12 - 0.08 * k : 1.06;
  const pan = m.move === "left" ? 30 - 60 * k : m.move === "right" ? -30 + 60 * k : 0;
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: m.fit, transform: `scale(${zoom}) translateX(${pan}px)` };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a.kind === "video" ? <Video src={a.url} trimBefore={Math.round(m.from * FPS)} style={{ ...style, objectFit: undefined }} objectFit={m.fit} /> : <Img src={a.url} style={style} />}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${0.55 * dim}) 0%, rgba(0,0,0,${0.12 * dim}) 38%, rgba(0,0,0,${0.1 * dim}) 60%, rgba(0,0,0,${0.6 * dim}) 100%)` }} />
    </AbsoluteFill>
  );
};

/** Content area inside Meta's safe box (x 90–990, y 290–1250). `center` balances the block vertically. */
const Box: React.FC<React.PropsWithChildren<{ top?: number; center?: boolean }>> = ({ children, top = 330, center = true }) =>
  center ? (
    <div style={{ position: "absolute", left: 90, right: 90, top: 290, height: 760, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div>{children}</div>
    </div>
  ) : (
    <div style={{ position: "absolute", left: 90, right: 90, top }}>{children}</div>
  );

const SceneBody: React.FC<{ s: Scene; t: number; pal: Palette; spec: VideoSpec; font: string; first: boolean; onMedia: boolean }> = ({ s, t, pal, spec, font, first, onMedia }) => {
  const accent = spec.theme.look === "bold" ? "#ffffff" : spec.theme.accent;
  const text = onMedia || spec.theme.look === "bold" || spec.theme.look === "dark" ? (onMedia ? "#ffffff" : pal.text) : pal.text;
  const sub = onMedia ? "rgba(255,255,255,0.82)" : pal.sub;
  const hi = onMedia ? tint(spec.theme.accent, 0.35) : accent;
  const subP = ease(t, 0.35, 0.8);
  const Sub = s.subtitle ? <div style={{ fontFamily: font, fontSize: 48, fontWeight: 500, lineHeight: 1.25, color: sub, marginTop: 26, opacity: first ? 1 : subP, transform: `translateY(${first ? 0 : (1 - subP) * 18}px)` }}>{s.subtitle}</div> : null;

  switch (s.kind) {
    case "hook":
      return (
        <Box top={360} center={false}>
          <Title text={s.title} emphasis={s.emphasis} size={s.title.length > 40 ? 92 : 108} t={t} at={0} color={text} accent={hi} font={font} instant={first} underline={onMedia} />
          {Sub}
        </Box>
      );
    case "list":
    case "steps": {
      const n = s.items.length;
      const gap = Math.max(0.28, Math.min(0.7, (s.duration - 1.2) / Math.max(1, n)));
      return (
        <Box top={320}>
          {s.title ? <Title text={s.title} emphasis={s.emphasis} size={68} t={t} at={0} color={text} accent={hi} font={font} instant={first} underline={onMedia} /> : null}
          <div style={{ marginTop: 44, position: "relative" }}>
            {s.kind === "steps" && n > 1 ? <div style={{ position: "absolute", left: 34, top: 40, width: 4, borderRadius: 2, height: 108 * (n - 1) * ease(t, 0.5, 0.5 + gap * n, (x) => x), background: alpha(spec.theme.accent, 0.5) }} /> : null}
            {s.items.map((it, i) => {
              const p = spr(t, 0.45 + i * gap, 16, 150);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, height: 108, opacity: Math.min(1, p * 1.3), transform: `translateX(${(1 - p) * 60}px)` }}>
                  <div style={{ flex: "0 0 auto", width: 72, height: 72, borderRadius: 36, background: spec.theme.look === "bold" ? "#ffffff" : spec.theme.accent, color: spec.theme.look === "bold" ? spec.theme.accent : "#ffffff", fontFamily: font, fontSize: 36, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                  <div style={{ fontFamily: font, fontSize: 52, fontWeight: 650, lineHeight: 1.12, color: text }}>{it}</div>
                </div>
              );
            })}
          </div>
        </Box>
      );
    }
    case "stat": {
      const num = parseFloat(s.value.replace(/[^0-9.]/g, ""));
      const count = ease(t, 0.25, 1.3);
      const shown = Number.isFinite(num) && /^[^0-9]*[0-9.,]+[^0-9]*$/.test(s.value) ? s.value.replace(/[0-9.,]+/, (m) => formatLike(m, num * count)) : s.value;
      return (
        <Box top={330}>
          {s.title ? <Title text={s.title} emphasis={s.emphasis} size={60} t={t} at={0} color={text} accent={hi} font={font} instant={first} weight={700} /> : null}
          <div style={{ fontFamily: font, fontSize: 230, fontWeight: 850, letterSpacing: -8, lineHeight: 1, color: hi, marginTop: 30, transform: `scale(${0.9 + 0.1 * spr(t, 0.2, 14, 140)})`, transformOrigin: "0 50%" }}>{shown}</div>
          {s.label ? <div style={{ fontFamily: font, fontSize: 52, fontWeight: 600, color: sub, marginTop: 18, opacity: ease(t, 0.9, 1.3) }}>{s.label}</div> : null}
        </Box>
      );
    }
    case "quote":
      return (
        <Box top={320}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 220, lineHeight: 0.8, color: hi, height: 130 }}>“</div>
          <div style={{ fontFamily: font, fontSize: s.title.length > 70 ? 58 : 70, fontWeight: 600, fontStyle: "italic", lineHeight: 1.18, color: text, opacity: first ? 1 : ease(t, 0.1, 0.6) }}>{s.title}</div>
          {s.label ? <div style={{ fontFamily: font, fontSize: 44, fontWeight: 600, color: sub, marginTop: 30, opacity: ease(t, 0.6, 1.0) }}>— {s.label}</div> : null}
        </Box>
      );
    case "compare": {
      const [a, b] = [s.items[0] ?? "", s.items[1] ?? ""];
      const pa = spr(t, 0.3, 16, 150), pb = spr(t, 0.9, 16, 150);
      const card = (txt: string, p: number, good: boolean): React.ReactNode => (
        <div style={{ flex: 1, minHeight: 360, borderRadius: 40, padding: 34, boxSizing: "border-box", background: good ? (spec.theme.look === "bold" ? "#ffffff" : spec.theme.accent) : onMedia ? "rgba(0,0,0,0.45)" : pal.card, color: good ? (spec.theme.look === "bold" ? spec.theme.accent : "#ffffff") : onMedia ? "#fff" : pal.cardText, boxShadow: pal.shadow, opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 60}px)`, fontFamily: font }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{good ? "✓" : "✕"}</div>
          <div style={{ fontSize: 48, fontWeight: 650, lineHeight: 1.15, marginTop: 24 }}>{txt}</div>
        </div>
      );
      return (
        <Box top={320}>
          {s.title ? <Title text={s.title} emphasis={s.emphasis} size={66} t={t} at={0} color={text} accent={hi} font={font} instant={first} underline={onMedia} /> : null}
          {s.label ? <div style={{ fontFamily: font, fontSize: 40, color: sub, marginTop: 12 }}>{s.label}</div> : null}
          <div style={{ display: "flex", gap: 26, marginTop: 40 }}>
            {card(a, pa, false)}
            {card(b, pb, true)}
          </div>
        </Box>
      );
    }
    case "cta": {
      const p = spr(t, 0.15, 14, 130);
      const pulse = 1 + 0.03 * Math.sin(t * 5);
      return (
        <div style={{ position: "absolute", left: 90, right: 90, top: 290, height: 760, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <Title text={s.title} emphasis={s.emphasis} size={86} t={t} at={0} color={text} accent={hi} font={font} instant={first} align="center" />
          {Sub}
          {spec.handle ? (
            <div style={{ marginTop: 56, padding: "24px 46px", borderRadius: 999, background: spec.theme.look === "bold" ? "#ffffff" : spec.theme.accent, color: spec.theme.look === "bold" ? spec.theme.accent : "#ffffff", fontFamily: font, fontSize: 52, fontWeight: 750, boxShadow: pal.shadow, transform: `scale(${(0.7 + 0.3 * p) * pulse})`, opacity: Math.min(1, p * 1.4) }}>{spec.handle}</div>
          ) : null}
        </div>
      );
    }
    case "media":
      return s.title ? (
        <Box top={320} center={false}>
          <Title text={s.title} emphasis={s.emphasis} size={76} t={t} at={0.1} color={"#ffffff"} accent={tint(spec.theme.accent, 0.35)} font={font} instant={first} underline />
          {s.subtitle ? <div style={{ fontFamily: font, fontSize: 46, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginTop: 20 }}>{s.subtitle}</div> : null}
        </Box>
      ) : null;
    default:
      return (
        <Box>
          <Title text={s.title} emphasis={s.emphasis} size={s.title.length > 48 ? 76 : 88} t={t} at={0} color={text} accent={hi} font={font} instant={first} underline={onMedia} />
          {Sub}
        </Box>
      );
  }
}
function formatLike(src: string, v: number) {
  const dec = src.includes(".") ? src.split(".")[1].length : 0;
  const s = v.toFixed(dec);
  return src.includes(",") && !src.includes(".") ? Number(s).toLocaleString("en-US") : s;
}

const Backdrop: React.FC<{ spec: VideoSpec; pal: Palette; t: number }> = ({ spec, pal, t }) => {
  // A slow drifting angle keeps the background alive without blobs (radial gradients don't render in the browser encoder).
  const a = 155 + Math.sin(t * 0.25) * 18;
  const glow = spec.theme.look === "bold" ? "rgba(255,255,255,0.10)" : alpha(spec.theme.accent, spec.theme.look === "dark" ? 0.22 : 0.13);
  const glow2 = spec.theme.look === "bold" ? "rgba(0,0,0,0.10)" : alpha(spec.theme.accent2, spec.theme.look === "dark" ? 0.18 : 0.16);
  return (
    <AbsoluteFill style={{ background: pal.bg }}>
      <AbsoluteFill style={{ background: `linear-gradient(${a}deg, ${glow} 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0) 62%, ${glow2} 100%)` }} />
    </AbsoluteFill>
  );
};

export type ReelProps = { spec: VideoSpec; attachments: Attachment[] };

export const ReelComposition: React.FC<ReelProps> = ({ spec, attachments }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / FPS;
  const pal = palette(spec);
  const font = FONT_STACKS[spec.theme.font];
  const tl = timeline(spec);
  const byId = new Map(attachments.map((a) => [a.id, a]));
  const total = durationInFrames / FPS;
  const videoNow = spec.scenes.some((s, i) => s.media && byId.get(s.media.ref)?.kind === "video" && t >= tl[i].start && t < tl[i].end);
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Backdrop spec={spec} pal={pal} t={t} />
      {spec.scenes.map((s, i) => {
        const { start, end } = tl[i];
        const next = spec.scenes[i + 1];
        const isLast = i === spec.scenes.length - 1;
        if (t < start || (!isLast && t >= end + OVERLAP)) return null;
        const lt = t - start;
        const p = i === 0 || s.transition === "cut" ? 1 : spr(t, start, 20, 120);
        const pn = next && next.transition !== "cut" ? spr(t, end, 20, 120) : t >= end && next ? 1 : 0;
        let tx = 0, ty = 0, sc = 1, op = 1, blur = 0;
        let clip: string | undefined;
        if (i > 0) {
          if (s.transition === "push") tx += (1 - p) * 1080;
          if (s.transition === "lift") { ty += (1 - p) * 700; op *= ease(t, start, start + 0.25); }
          if (s.transition === "fade") { sc *= 0.94 + 0.06 * p; op *= Math.min(1, p * 1.2); blur += (1 - p) * 14; }
          if (s.transition === "zoom") { sc *= interpolate(p, [0, 1], [1.35, 1]); op *= ease(t, start, start + 0.35); }
        }
        if (next) {
          const nt = next.transition;
          if (nt === "push") tx -= 0.3 * 1080 * pn;
          if (nt === "lift") { ty -= 380 * pn; op *= 1 - ease(t, end, end + 0.4); }
          if (nt === "fade") { sc *= 1 + 0.05 * pn; op *= 1 - ease(t, end, end + 0.4); blur += pn * 10; }
          if (nt === "zoom") { sc *= interpolate(pn, [0, 1], [1, 0.82]); op *= 1 - ease(t, end, end + 0.4); }
          if (nt === "cut" && t >= end) op = 0;
        }
        if (s.transition === "zoom" && i > 0) clip = `inset(${(1 - p) * 30}% ${(1 - p) * 20}% round ${(1 - p) * 80}px)`;
        const att = s.media ? byId.get(s.media.ref) : undefined;
        return (
          <AbsoluteFill key={i} style={{ transform: `translate(${tx}px, ${ty}px) scale(${sc})`, opacity: op, filter: blur ? `blur(${blur}px)` : undefined, clipPath: clip, boxShadow: s.transition === "push" && p < 1 ? "-40px 0 80px rgba(0,0,0,0.18)" : undefined, overflow: "hidden" }}>
            <Backdrop spec={spec} pal={pal} t={t} />
            {att ? (
              <Sequence from={Math.round(start * FPS)} layout="none">
                <MediaLayer a={att} scene={s} t={lt} dim={s.kind === "media" && !s.title ? 0.6 : 1} />
              </Sequence>
            ) : null}
            <SceneBody s={s} t={lt} pal={pal} spec={spec} font={font} first={i === 0} onMedia={!!att} />
            {s.caption ? <CaptionBand text={s.caption} t={lt} duration={s.duration} pal={pal} font={font} /> : null}
          </AbsoluteFill>
        );
      })}
      {/* Audio: original beds bundled with the hub (licence-free), ducked under clips that carry their own sound. */}
      {spec.music.mood !== "none" ? (
        <Audio
          src={`/video/music/${spec.music.mood}.m4a`}
          loop
          volume={(f) => {
            const s = f / FPS;
            const fade = Math.min(1, s / 0.4) * Math.min(1, Math.max(0, (total - s) / 1.2));
            return spec.music.volume * fade * (videoNow ? 0.35 : 1);
          }}
        />
      ) : null}
      {spec.scenes.map((s, i) =>
        s.sfx !== "none" ? (
          <Sequence key={`sfx${i}`} from={Math.max(0, Math.round((tl[i].start - (s.sfx.startsWith("whoosh") ? 0.08 : 0)) * FPS))} durationInFrames={FPS * 2} layout="none">
            <Audio src={`/video/sfx/${s.sfx}.m4a`} volume={s.sfx === "hit" ? 0.4 : 0.5} />
          </Sequence>
        ) : null,
      )}
      {spec.scenes.map((s, i) =>
        (s.kind === "list" || s.kind === "steps") && s.items.length
          ? s.items.map((_, k) => {
              const gap = Math.max(0.28, Math.min(0.7, (s.duration - 1.2) / Math.max(1, s.items.length)));
              return (
                <Sequence key={`it${i}-${k}`} from={Math.round((tl[i].start + 0.45 + k * gap) * FPS)} durationInFrames={FPS} layout="none">
                  <Audio src="/video/sfx/pop.m4a" volume={0.22} />
                </Sequence>
              );
            })
          : null,
      )}
    </AbsoluteFill>
  );
};
