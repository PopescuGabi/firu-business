// The page's side of on-device speech: starts the worker, tracks download progress, and turns its
// messages into promises. See worker.ts for what runs where.
import type { WorkerIn, WorkerOut } from "./worker";

export type Part = "idle" | "loading" | "ready" | "failed";
export type LocalSpeechState = {
  tts: Part;
  stt: Part;
  ttsProgress: number;
  sttProgress: number;
  /** How long speech takes to make, as a share of its length (0.5 = twice as fast as real time). */
  speed: number | null;
  error: string | null;
};

/** Kokoro's male voices. George is the calm, mature British one. */
export const LOCAL_VOICES = [
  { id: "bm_george", label: "George (British)" },
  { id: "bm_fable", label: "Fable (British)" },
  { id: "bm_lewis", label: "Lewis (British)" },
  { id: "bm_daniel", label: "Daniel (British)" },
  { id: "am_michael", label: "Michael (American)" },
] as const;

let state: LocalSpeechState = { tts: "idle", stt: "idle", ttsProgress: 0, sttProgress: 0, speed: null, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<LocalSpeechState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>();

function start() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<WorkerOut>) => {
    const m = e.data;
    if (m.type === "progress") set(m.what === "tts" ? { ttsProgress: m.ratio } : { sttProgress: m.ratio });
    else if (m.type === "ready") set(m.what === "tts" ? { tts: "ready", ttsProgress: 1 } : { stt: "ready", sttProgress: 1 });
    else if (m.type === "failed") set({ [m.what]: "failed", error: m.error } as Partial<LocalSpeechState>);
    else if (m.type === "spoken") {
      set({ speed: m.ms / ((m.audio.length / m.rate) * 1000) });
      waiting.get(m.id)?.resolve({ audio: m.audio, rate: m.rate } as never);
      waiting.delete(m.id);
    } else if (m.type === "transcribed") {
      waiting.get(m.id)?.resolve(m.text as never);
      waiting.delete(m.id);
    } else if (m.type === "error") {
      waiting.get(m.id)?.reject(new Error(m.error));
      waiting.delete(m.id);
    }
  };
  worker.onerror = (e) => {
    set({ tts: state.tts === "loading" ? "failed" : state.tts, stt: state.stt === "loading" ? "failed" : state.stt, error: e.message || "The speech worker stopped." });
    for (const w of waiting.values()) w.reject(new Error("The speech worker stopped."));
    waiting.clear();
  };
  return worker;
}
const send = (m: WorkerIn, transfer: Transferable[] = []) => start().postMessage(m, transfer);
const request = <T>(m: (id: number) => WorkerIn, transfer: Transferable[] = []) =>
  new Promise<T>((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve: resolve as (v: never) => void, reject });
    send(m(id), transfer);
  });

/** 16-bit mono WAV from float samples (what an <audio> element can play). */
export function wavBlob(samples: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const text = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: "audio/wav" });
}

/** A recording (any format the browser can decode) as 16 kHz mono samples, which Whisper expects. */
export async function to16kMono(blob: Blob) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < ch.length; i++) out[i] += ch[i] / decoded.numberOfChannels;
    }
    return out;
  } finally {
    void ctx.close();
  }
}

export type SpeechPlan = {
  voice: { device: "webgpu" | "wasm"; dtype: string };
  hearing: { model: string; device: "webgpu" | "wasm"; dtype: string | Record<string, string> };
  /** The one-time download, in megabytes. */
  megabytes: number;
};

async function hasWebGpu() {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return Boolean(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

/** The small 8-bit builds on the CPU: they work everywhere, but the voice is slower than real time on most devices. */
const LIGHT: SpeechPlan = {
  voice: { device: "wasm", dtype: "q8" },
  hearing: { model: "onnx-community/whisper-base", device: "wasm", dtype: "q8" },
  megabytes: 170,
};
/**
 * Full-precision builds on the GPU (WebGPU). Measured on an Apple-silicon Mac in Chrome: a 4.8 s sentence is
 * spoken in 0.85 s, and Whisper small transcribes a request in 0.8 s. (The half-precision voice build is
 * faster to download but comes out garbled, so it isn't used.)
 */
const FULL: SpeechPlan = {
  voice: { device: "webgpu", dtype: "fp32" },
  hearing: { model: "onnx-community/whisper-small", device: "webgpu", dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
  megabytes: 910,
};

/** Which builds this device gets: the full ones on a computer with a GPU, the light ones on phones and without WebGPU. */
export async function planFor(phone: boolean): Promise<SpeechPlan> {
  // Testing aid: localStorage "jarvis.plan" may hold a SpeechPlan as JSON.
  try {
    const forced = localStorage.getItem("jarvis.plan");
    if (forced) return JSON.parse(forced) as SpeechPlan;
  } catch {}
  return !phone && (await hasWebGpu()) ? FULL : LIGHT;
}

export const localSpeech = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  get: () => state,
  supported: () => typeof Worker !== "undefined" && typeof WebAssembly !== "undefined",
  loadVoice(plan: SpeechPlan["voice"]) {
    if (state.tts !== "idle" && state.tts !== "failed") return;
    set({ tts: "loading", error: null });
    send({ type: "load-tts", device: plan.device, dtype: plan.dtype });
  },
  loadHearing(plan: SpeechPlan["hearing"]) {
    if (state.stt !== "idle" && state.stt !== "failed") return;
    set({ stt: "loading", error: null });
    send({ type: "load-stt", model: plan.model, device: plan.device, dtype: plan.dtype });
  },
  /** Natural speech for one sentence or short passage (English). */
  async speak(text: string, voice: string) {
    const { audio, rate } = await request<{ audio: Float32Array; rate: number }>((id) => ({ type: "speak", id, text, voice }));
    return wavBlob(audio, rate);
  },
  /** What was said in a recording. */
  async transcribe(recording: Blob, language: "english" | "romanian") {
    const audio = await to16kMono(recording);
    return request<string>((id) => ({ type: "transcribe", id, audio, language }), [audio.buffer]);
  },
};
