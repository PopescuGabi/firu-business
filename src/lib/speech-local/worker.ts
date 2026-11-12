/// <reference lib="webworker" />
// On-device speech, in a worker so the page never stutters:
// - voice: Kokoro (82M-parameter open neural TTS, Apache 2.0), British English voices
// - hearing: Whisper (open speech recognition, MIT), multilingual
// Models download once from Hugging Face and are cached by the browser. Nothing is sent to a server:
// the audio you record and the text Jarvis speaks stay on this device.
import { env, pipeline } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";

// The WebAssembly runtime is served by this site (public/ort, copied from onnxruntime-web by
// scripts/copy-ort.mjs), so no script is loaded from another origin.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/ort/`;

export type WorkerIn =
  | { type: "load-tts"; device: "webgpu" | "wasm"; dtype: string }
  | { type: "load-stt"; model: string; device: "webgpu" | "wasm"; dtype: string | Record<string, string> }
  | { type: "speak"; id: number; text: string; voice: string }
  | { type: "transcribe"; id: number; audio: Float32Array; language: string };

export type WorkerOut =
  | { type: "progress"; what: "tts" | "stt"; ratio: number }
  | { type: "ready"; what: "tts" | "stt"; device: string }
  | { type: "failed"; what: "tts" | "stt"; error: string }
  | { type: "spoken"; id: number; audio: Float32Array; rate: number; ms: number }
  | { type: "transcribed"; id: number; text: string; ms: number }
  | { type: "error"; id: number; error: string };

const post = (m: WorkerOut, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

/** One 0–1 figure across all of a model's files. */
function tracker(what: "tts" | "stt") {
  const files = new Map<string, { loaded: number; total: number }>();
  let last = -1;
  return (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== "progress" || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) (loaded += f.loaded), (total += f.total);
    const ratio = Math.round((loaded / total) * 100) / 100;
    if (ratio !== last) post({ type: "progress", what, ratio: (last = ratio) });
  };
}

let tts: Promise<KokoroTTS> | null = null;
function loadTts(device: "webgpu" | "wasm", dtype: string) {
  tts ??= (async () => {
    const make = (d: "webgpu" | "wasm", t: string) =>
      KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: t as never, device: d, progress_callback: tracker("tts") });
    let used = device;
    let model: KokoroTTS;
    try {
      model = await make(device, dtype);
    } catch (e) {
      if (device !== "webgpu") throw e;
      used = "wasm"; // the GPU build didn't start: the small CPU build always does
      model = await make("wasm", "q8");
    }
    post({ type: "ready", what: "tts", device: used });
    return model;
  })();
  tts.catch((e: Error) => {
    tts = null;
    post({ type: "failed", what: "tts", error: e.message });
  });
  return tts;
}

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
let stt: Promise<Asr> | null = null;
function loadStt(model: string, device: "webgpu" | "wasm", dtype: string | Record<string, string>) {
  stt ??= (async () => {
    const make = (m: string, d: "webgpu" | "wasm", t: string | Record<string, string>) =>
      pipeline("automatic-speech-recognition", m, { device: d, dtype: t as never, progress_callback: tracker("stt") }) as unknown as Promise<Asr>;
    let used = device;
    let asr: Asr;
    try {
      asr = await make(model, device, dtype);
    } catch (e) {
      if (device !== "webgpu") throw e;
      used = "wasm";
      asr = await make("onnx-community/whisper-base", "wasm", "q8");
    }
    post({ type: "ready", what: "stt", device: used });
    return asr;
  })();
  stt.catch((e: Error) => {
    stt = null;
    post({ type: "failed", what: "stt", error: e.message });
  });
  return stt;
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  try {
    if (m.type === "load-tts") await loadTts(m.device, m.dtype);
    else if (m.type === "load-stt") await loadStt(m.model, m.device, m.dtype);
    else if (m.type === "speak") {
      const model = await (tts ?? Promise.reject(new Error("The voice isn't loaded.")));
      const t0 = performance.now();
      const out = await model.generate(m.text, { voice: m.voice as never });
      const audio = out.audio as Float32Array;
      post({ type: "spoken", id: m.id, audio, rate: out.sampling_rate, ms: performance.now() - t0 }, [audio.buffer]);
    } else if (m.type === "transcribe") {
      const asr = await (stt ?? Promise.reject(new Error("Speech recognition isn't loaded.")));
      const t0 = performance.now();
      const out = await asr(m.audio, { language: m.language, task: "transcribe" });
      const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).trim();
      post({ type: "transcribed", id: m.id, text, ms: performance.now() - t0 });
    }
  } catch (err) {
    if ("id" in m) post({ type: "error", id: m.id, error: (err as Error).message });
  }
};
