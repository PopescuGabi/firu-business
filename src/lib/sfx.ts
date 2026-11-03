// Small interface sounds, synthesized with Web Audio (no sound files). Quiet on purpose.
// Turned on or off in Settings → Appearance; <SoundEffects> keeps `enabled` in step.

export type Sound = "tap" | "nav" | "toggle" | "success" | "remove";

let ctx: AudioContext | null = null;
let enabled = true;
const MASTER = 0.5;

export const setSoundsEnabled = (on: boolean) => {
  enabled = on;
};

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One tone with a quick attack and an exponential fade. */
function tone(a: AudioContext, at: number, freq: number, { dur = 0.08, gain = 0.05, type = "sine" as OscillatorType, to }: { dur?: number; gain?: number; type?: OscillatorType; to?: number } = {}) {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain * MASTER, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** A soft airy swish: filtered noise sweeping up. */
function swish(a: AudioContext, at: number) {
  const len = Math.floor(a.sampleRate * 0.14);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(900, at);
  bp.frequency.exponentialRampToValueAtTime(2600, at + 0.13);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.035 * MASTER, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(at);
}

export function play(sound: Sound) {
  if (!enabled || typeof window === "undefined" || document.hidden) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  switch (sound) {
    case "tap":
      tone(a, t, 1250, { dur: 0.045, gain: 0.045, to: 900 });
      break;
    case "nav":
      swish(a, t);
      tone(a, t, 700, { dur: 0.06, gain: 0.02, to: 1000 });
      break;
    case "toggle":
      tone(a, t, 880, { dur: 0.04, gain: 0.04, type: "triangle" });
      tone(a, t + 0.045, 1320, { dur: 0.05, gain: 0.04, type: "triangle" });
      break;
    case "success":
      [1046.5, 1318.5, 1568].forEach((f, k) => tone(a, t + k * 0.075, f, { dur: 0.28, gain: 0.045, type: "triangle" }));
      break;
    case "remove":
      tone(a, t, 240, { dur: 0.14, gain: 0.07, to: 110 });
      break;
  }
}
