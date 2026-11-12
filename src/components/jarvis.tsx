"use client";
// Jarvis: the assistant bar on every Dashboard page. Speak (browser speech recognition), type, or say "Jarvis"
// with the wake word on. Claude answers through /api/ai/jarvis, can act (plan the day, add tasks, update leads),
// and the reply is read aloud in a British voice, sentence by sentence as it streams in.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowUp, AudioLines, Check, Ear, EarOff, Mic, Square, Sunrise, Volume2, VolumeX, X } from "lucide-react";
import { ASSISTANT_NAME } from "@/lib/brand";
import { LOCAL_VOICES, localSpeech, planFor } from "@/lib/speech-local/client";
import { GlassSurface } from "./glass";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };
type Lang = "en-GB" | "ro-RO";

// The Web Speech API isn't in TypeScript's DOM types yet.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const recognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};
const todayKey = () => new Date().toLocaleDateString("en-CA");
const isPhone = () => window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;

/** "Good morning" (or "Bună dimineața") starts the briefing. */
const BRIEFING = /^\s*(good morning|morning|brief me|bun[ăa] diminea[țt]a)\b/i;
/** What speech recognition tends to hear for "Jarvis". */
const WAKE = /\b(jarvis|jarvi[sz]|jar vis|djarvis|jarviz|jervis)\b[,.!?]?\s*/i;

// Voices that sound like a calm British male assistant, best first: Edge's neural "Natural" voices, then macOS,
// Chrome and Windows ones. The browser decides which exist, so a phone may offer none of these.
const BRITISH = [
  "Microsoft Ryan Online",
  "Microsoft Thomas Online",
  "Microsoft Oliver Online",
  "Microsoft Alfie Online",
  "Microsoft Elliot Online",
  "Daniel",
  "Google UK English Male",
  "Arthur",
  "Microsoft George",
  "Microsoft Ryan",
  "Oliver",
  "Jamie",
  "Malcolm",
];
// Known female voice names, never chosen automatically (they can still be picked by hand).
const FEMALE = /female|kate|serena|stephanie|martha|flo\b|grandma|sandy|shelley|libby|sonia|maisie|hollie|bella|abbi|susan|hazel|ioana|emily|amy|olivia/i;
const norm = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-");
const forLang = (voices: SpeechSynthesisVoice[], lang: Lang) => voices.filter((v) => norm(v).startsWith(lang === "en-GB" ? "en" : "ro"));
function pickVoice(lang: Lang) {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = forLang(speechSynthesis.getVoices(), lang);
  const chosen = store.get(`jarvis.voice.${lang}`);
  const own = chosen && voices.find((v) => v.name === chosen);
  if (own) return own;
  if (lang === "en-GB") {
    for (const name of BRITISH) {
      const v = voices.find((x) => x.name.startsWith(name));
      if (v) return v;
    }
    const gb = voices.filter((v) => norm(v) === "en-GB");
    return gb.find((v) => !FEMALE.test(v.name)) ?? voices.find((v) => !FEMALE.test(v.name)) ?? gb[0] ?? voices[0] ?? null;
  }
  return voices.find((v) => !FEMALE.test(v.name)) ?? voices[0] ?? null;
}

/** Romanian if the sentence looks Romanian, else the bar's language (replies follow the language he spoke). */
const ROMANIAN = /[ăâîșțşţ]|\b(și|este|pentru|sunt|aveți|aveti|mâine|astăzi|azi|bună|vă|vreți|domnule)\b/i;

/**
 * Who speaks: "eleven" = ElevenLabs through the server (needs a key); "local" = the Kokoro neural voice running
 * on this device (free, English); "browser" = the system's built-in voice (the robotic fallback).
 */
type Engine = "eleven" | "local" | "browser";

/**
 * Speaks text in order; a new reply cancels whatever is still being read. With a neural engine each sentence
 * is prepared as natural speech while the previous one plays; otherwise the browser's voice reads it.
 */
function useSpeaker(lang: Lang, muted: boolean, engine: Engine, localVoice: string, onFail: (m: string) => void) {
  const [speaking, setSpeaking] = useState(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const gen = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const failed = useRef(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const queue = useRef(0);
  const refresh = useCallback(() => {
    if (typeof speechSynthesis === "undefined") return;
    setVoiceName(pickVoice(lang)?.name ?? null);
    setVoices(forLang(speechSynthesis.getVoices(), lang).map((v) => v.name));
  }, [lang]);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    refresh();
    speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, [refresh]);
  /** Pin a voice for this language on this device ("" goes back to the automatic choice). */
  const chooseVoice = useCallback(
    (name: string) => {
      store.set(`jarvis.voice.${lang}`, name);
      refresh();
    },
    [lang, refresh],
  );
  const browserSay = useCallback(
    (text: string) => {
      if (muted || typeof speechSynthesis === "undefined" || !text.trim()) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      // Measured and a touch low, like a butler; Romanian voices keep their natural pitch.
      u.rate = lang === "en-GB" ? 0.98 : 1.02;
      u.pitch = lang === "en-GB" ? 0.9 : 1;
      queue.current++;
      setSpeaking(true);
      u.onend = u.onerror = () => {
        queue.current = Math.max(0, queue.current - 1);
        if (queue.current === 0) setSpeaking(false);
      };
      speechSynthesis.speak(u);
    },
    [lang, muted],
  );
  /** The browser voice, as a promise that settles when the sentence has been read. */
  const browserSpeak = useCallback(
    (text: string) =>
      new Promise<void>((done) => {
        if (typeof speechSynthesis === "undefined") return done();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        const voice = pickVoice(lang);
        if (voice) u.voice = voice;
        u.rate = lang === "en-GB" ? 0.98 : 1.02;
        u.pitch = lang === "en-GB" ? 0.9 : 1;
        u.onend = u.onerror = () => done();
        speechSynthesis.speak(u);
      }),
    [lang],
  );
  const neuralSay = useCallback(
    (text: string) => {
      if (muted || !text.trim()) return;
      const g = gen.current;
      const romanian = ROMANIAN.test(text) || lang === "ro-RO";
      // The on-device voice speaks English only; Romanian sentences go to the browser's Romanian voice.
      const useBrowser = failed.current || (engine === "local" && romanian);
      // Start preparing now so the audio is ready when the previous sentence ends.
      const clip: Promise<Blob> | null = useBrowser
        ? null
        : engine === "local"
          ? localSpeech.speak(text, localVoice)
          : fetch("/api/speech/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, lang: romanian ? "ro" : "en" }),
            }).then(async (r) => {
              if (r.ok) return r.blob();
              const j = await r.json().catch(() => null);
              throw new Error(j?.error ?? `Voice unavailable (${r.status}).`);
            });
      clip?.catch(() => {}); // handled in the chain below
      queue.current++;
      setSpeaking(true);
      chain.current = chain.current
        .then(async () => {
          if (g !== gen.current) return;
          if (!clip) return browserSpeak(text);
          try {
            const blob = await clip;
            if (g !== gen.current) return;
            const url = URL.createObjectURL(blob);
            const a = new Audio(url);
            audio.current = a;
            await new Promise<void>((done) => {
              a.onended = a.onerror = () => done();
              a.play().catch(() => done());
            });
            URL.revokeObjectURL(url);
            // A device that needs longer to make speech than to play it can't keep a conversation going.
            const speed = engine === "local" ? localSpeech.get().speed : null;
            if (speed && speed > 1.25 && !failed.current) {
              failed.current = true;
              onFail("This device is too slow for the natural voice, so the browser voice is used here.");
            }
          } catch (e) {
            if (!failed.current) onFail(`${(e as Error).message} Using the browser voice for now.`);
            failed.current = true;
            if (g === gen.current) await browserSpeak(text);
          }
        })
        .finally(() => {
          if (g !== gen.current) return;
          queue.current = Math.max(0, queue.current - 1);
          if (queue.current === 0) setSpeaking(false);
        });
    },
    [browserSpeak, engine, lang, localVoice, muted, onFail],
  );
  const say = engine === "browser" ? browserSay : neuralSay;
  const stop = useCallback(() => {
    gen.current++;
    chain.current = Promise.resolve();
    audio.current?.pause();
    audio.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    queue.current = 0;
    setSpeaking(false);
  }, []);
  return { say, stop, speaking, voiceName, voices, chooseVoice };
}

/**
 * Records one spoken request: starts on the mic button (or after "Jarvis"), stops by itself after about
 * 1.3 s of silence once you've spoken, after 4 s if you never start, or at 30 s.
 */
async function recordRequest(handle: { stop?: () => void }, onSpeech: () => void): Promise<Blob | null> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const started = performance.now();
  let spokeAt = 0;
  let quietSince = 0;
  let cancelled = false;
  return new Promise((resolve) => {
    const finish = () => {
      clearInterval(timer);
      if (recorder.state !== "inactive") recorder.stop();
    };
    handle.stop = finish;
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      resolve(cancelled || !spokeAt ? null : new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const level = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (level > 0.025) {
        if (!spokeAt) onSpeech();
        spokeAt = now;
        quietSince = 0;
      } else if (spokeAt) {
        quietSince ||= now;
        if (now - quietSince > 1300) finish();
      }
      if (!spokeAt && now - started > 4000) {
        cancelled = true;
        finish();
      }
      if (now - started > 30_000) finish();
    }, 80);
    recorder.start(250);
  });
}

/** `premium`: an ElevenLabs key is set, so Jarvis speaks with a natural voice and transcribes recorded requests. */
export function Jarvis({ premium = false }: { premium?: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("en-GB");
  const [muted, setMuted] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);
  const [offerBriefing, setOfferBriefing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rec = useRef<Recognition | null>(null);
  const wakeRec = useRef<Recognition | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [transcribing, setTranscribing] = useState(false);
  const recHandle = useRef<{ stop?: () => void }>({});
  const [canRecord, setCanRecord] = useState(false);
  // On-device speech (free, no key): on by default on computers; phones are asked first (a 170 MB download).
  const local = useSyncExternalStore(localSpeech.subscribe, localSpeech.get, localSpeech.get);
  const [localOn, setLocalOn] = useState<boolean | null>(null);
  const [localVoice, setLocalVoice] = useState<string>(LOCAL_VOICES[0].id);
  const [offerLocal, setOfferLocal] = useState(false);
  const [localMb, setLocalMb] = useState(170);
  const engine: Engine = premium ? "eleven" : localOn && local.tts === "ready" ? "local" : "browser";
  const { say, stop: stopSpeaking, speaking, voiceName, voices, chooseVoice } = useSpeaker(lang, muted, engine, localVoice, setError);
  const [voiceMenu, setVoiceMenu] = useState(false);

  useEffect(() => {
    const recorder = typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    setCanRecord(premium && recorder);
    setCanListen(recorder || Boolean(recognitionCtor()));
    if (process.env.NODE_ENV !== "production") (window as unknown as { __speech?: unknown }).__speech = localSpeech;
    const v = store.get("jarvis.localVoice");
    if (v && LOCAL_VOICES.some((x) => x.id === v)) setLocalVoice(v);
    if (!premium && localSpeech.supported()) {
      const saved = store.get("jarvis.local");
      const phone = isPhone();
      void planFor(phone).then((plan) => setLocalMb(plan.megabytes));
      const saver = Boolean((navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData);
      if (saved === "1") setLocalOn(true);
      else if (saved === "0") setLocalOn(false);
      else if (phone || saver) setOfferLocal(true);
      else setLocalOn(true);
    }
    const l = store.get("jarvis.lang");
    if (l === "en-GB" || l === "ro-RO") setLang(l);
    setMuted(store.get("jarvis.muted") === "1");
    setWakeOn(store.get("jarvis.wake") === "1");
    // Once a day, before mid-afternoon, Jarvis offers the briefing (a click is needed before a page may speak).
    if (store.get("jarvis.briefed") !== todayKey() && new Date().getHours() < 15) setOfferBriefing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount
  }, []);

  // Fetch the on-device models a moment after the page settles (once; the browser caches them).
  useEffect(() => {
    if (!localOn || premium) return;
    const t = setTimeout(async () => {
      const plan = await planFor(isPhone());
      setLocalMb(plan.megabytes);
      localSpeech.loadVoice(plan.voice);
      localSpeech.loadHearing(plan.hearing);
    }, 2500);
    return () => clearTimeout(t);
  }, [localOn, premium]);
  // Recorded requests work as soon as there is something accurate to transcribe them with.
  const recordReady = canRecord || (Boolean(localOn) && local.stt === "ready" && typeof MediaRecorder !== "undefined");

  // ⌘J / Ctrl+J focuses Jarvis from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  const ask = useCallback(
    async (text: string, opts: { briefing?: boolean } = {}) => {
      const q = text.trim();
      if (!q || busy) return;
      const briefing = opts.briefing ?? BRIEFING.test(q);
      if (briefing) {
        store.set("jarvis.briefed", todayKey());
        setOfferBriefing(false);
      }
      stopSpeaking();
      setError(null);
      setInput("");
      setOpen(true);
      const history: Msg[] = [...messages, { role: "user" as const, content: q }].slice(-10);
      setMessages([...history, { role: "assistant", content: "", actions: [] }]);
      setBusy(true);
      abort.current = new AbortController();
      let full = "";
      let spoken = 0;
      const actions: string[] = [];
      const update = () => setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: full, actions: [...actions] }]);
      // Speak each finished sentence while the rest is still arriving.
      const speakReady = (final: boolean) => {
        const rest = full.slice(spoken);
        const m = final ? rest.length : Math.max(rest.lastIndexOf(". "), rest.lastIndexOf("? "), rest.lastIndexOf("! "), rest.lastIndexOf("\n")) + 1;
        if (m > 0) {
          say(rest.slice(0, m));
          spoken += m;
        }
      };
      let changed = false;
      try {
        const res = await fetch("/api/ai/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), briefing }),
          signal: abort.current.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `${ASSISTANT_NAME} couldn't answer (${res.status}).`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as { type: string; text?: string; error?: string; changed?: boolean };
            if (ev.type === "text" && ev.text) {
              full += ev.text;
              update();
              speakReady(false);
            } else if (ev.type === "action" && ev.text) {
              actions.push(ev.text);
              update();
            } else if (ev.type === "done") changed = Boolean(ev.changed);
            else if (ev.type === "error") throw new Error(ev.error);
          }
        }
        speakReady(true);
        // Tasks, plans or leads changed: refresh the page underneath so it shows them.
        if (changed) router.refresh();
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
        setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content && !m.at(-1)?.actions?.length ? m.slice(0, -1) : m));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, messages, router, say, stopSpeaking],
  );

  // With ElevenLabs: record the request and transcribe it with Scribe (accurate, any language, names and food
  // included). Without: the browser's recogniser.
  const listenRecorded = useCallback(async () => {
    if (listening) {
      recHandle.current.stop?.();
      return;
    }
    wakeRec.current?.abort();
    stopSpeaking();
    setError(null);
    setListening(true);
    setInput("");
    try {
      const blob = await recordRequest(recHandle.current, () => setInput("…"));
      setListening(false);
      if (!blob) {
        setInput("");
        return;
      }
      setTranscribing(true);
      let text: string;
      if (premium) {
        const form = new FormData();
        form.append("audio", blob, blob.type.includes("mp4") ? "request.m4a" : "request.webm");
        const res = await fetch("/api/speech/stt", { method: "POST", body: form });
        const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) throw new Error(j.error ?? `Couldn't transcribe (${res.status}).`);
        text = j.text ?? "";
      } else {
        // Whisper on this device; the recording never leaves it.
        text = await localSpeech.transcribe(blob, lang === "ro-RO" ? "romanian" : "english");
      }
      setTranscribing(false);
      setInput("");
      // Whisper writes "[BLANK_AUDIO]" or "(music)" for noise; that isn't a request.
      text = text.replace(/[\[(][^\])]*[\])]/g, "").trim();
      if (text) void ask(text);
    } catch (e) {
      setListening(false);
      setTranscribing(false);
      setInput("");
      const name = (e as Error).name;
      setError(name === "NotAllowedError" ? "Microphone access is blocked. Allow it in the browser's site settings." : (e as Error).message);
    }
  }, [ask, lang, listening, premium, stopSpeaking]);

  const listen = useCallback(() => {
    if (recordReady) {
      void listenRecorded();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    wakeRec.current?.abort(); // one microphone user at a time; the wake listener restarts afterwards
    stopSpeaking();
    setError(null);
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    let heard = "";
    r.onresult = (e) => {
      heard = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(" ");
      setInput(heard);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Microphone access is blocked. Allow it in the browser's site settings.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Couldn't hear that (${e.error}).`);
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (heard.trim()) void ask(heard);
    };
    rec.current = r;
    setListening(true);
    r.start();
  }, [ask, recordReady, lang, listenRecorded, listening, stopSpeaking]);

  // Wake word: while on, the tab listens for "Jarvis" and treats what follows as the request. It pauses while
  // Jarvis listens, thinks or speaks (so it doesn't hear itself) and whenever the tab is hidden.
  const askRef = useRef(ask);
  const listenRef = useRef(listen);
  const sayRef = useRef(say);
  const recordReadyRef = useRef(recordReady);
  useEffect(() => {
    recordReadyRef.current = recordReady;
    askRef.current = ask;
    listenRef.current = listen;
    sayRef.current = say;
  }, [ask, listen, say]);
  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!wakeOn || !Ctor || busy || listening || speaking || transcribing) return;
    let stopped = false;
    let r: Recognition | null = null;
    const start = () => {
      if (stopped || document.hidden) return;
      r = new Ctor();
      r.lang = lang;
      r.continuous = true;
      r.interimResults = false;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) continue;
          const said = e.results[i][0].transcript;
          const m = said.match(WAKE);
          if (!m) continue;
          const rest = said.slice((m.index ?? 0) + m[0].length).trim();
          stopped = true;
          r?.abort();
          // With ElevenLabs the request itself is recorded and transcribed properly, so start recording now.
          if (recordReadyRef.current) setTimeout(() => listenRef.current(), 150);
          else if (rest.split(/\s+/).length >= 2) void askRef.current(rest);
          else {
            sayRef.current(lang === "en-GB" ? "Yes, sir?" : "Da?");
            setTimeout(() => listenRef.current(), 700);
          }
          return;
        }
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setWakeOn(false);
          store.set("jarvis.wake", "0");
          setError("Microphone access is blocked, so the wake word is off.");
        }
      };
      // Browsers end continuous listening after a silence; start again.
      r.onend = () => {
        if (!stopped) setTimeout(start, 300);
      };
      wakeRec.current = r;
      try {
        r.start();
      } catch {}
    };
    const onVisible = () => {
      if (document.hidden) r?.abort();
      else start();
    };
    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      r?.abort();
      wakeRec.current = null;
    };
  }, [wakeOn, busy, listening, speaking, transcribing, lang]);

  const stopAll = () => {
    abort.current?.abort();
    rec.current?.abort();
    stopSpeaking();
  };
  const toggleLang = () => {
    const next: Lang = lang === "en-GB" ? "ro-RO" : "en-GB";
    setLang(next);
    store.set("jarvis.lang", next);
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    store.set("jarvis.muted", next ? "1" : "0");
    if (next) stopSpeaking();
  };
  const toggleWake = () => {
    const next = !wakeOn;
    setWakeOn(next);
    store.set("jarvis.wake", next ? "1" : "0");
  };
  const brief = () => void ask(lang === "en-GB" ? "Good morning, Jarvis." : "Bună dimineața, Jarvis.", { briefing: true });

  const active = busy || listening || speaking || transcribing;
  return (
    <div className="jarvis pointer-events-none fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+80px)] z-40 flex flex-col items-center gap-2 md:bottom-5 md:left-[calc(64px+24px)] lg:left-[calc(236px+24px)]">
      {open && messages.length > 0 && (
        <GlassSurface
          as="section"
          contrast="high"
          radius={26}
          aria-label={`Conversation with ${ASSISTANT_NAME}`}
          className="jarvis-panel pointer-events-auto w-full max-w-[640px]"
          onKeyDown={(e: React.KeyboardEvent) => e.key === "Escape" && setOpen(false)}
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-[13px] font-semibold text-label-2">
              {ASSISTANT_NAME}
              {(engine !== "browser" || voiceName) && (
                <span className="font-normal text-label-3">
                  {" "}
                  · voice: {engine === "eleven" ? "ElevenLabs" : engine === "local" ? `${LOCAL_VOICES.find((v) => v.id === localVoice)?.label ?? "George"}, on this device` : voiceName}
                </span>
              )}
            </p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Hide conversation" className="grid size-7 place-items-center rounded-full text-label-2 hover:bg-fill">
              <X size={15} aria-hidden />
            </button>
          </div>
          <div ref={scroller} className="flex max-h-[min(46dvh,420px)] flex-col gap-2.5 overflow-y-auto px-4 pt-1 pb-4" aria-live="polite">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="max-w-[85%] self-end rounded-[16px] bg-accent px-3 py-2 text-[14px] text-white">
                  {m.content}
                </p>
              ) : (
                <div key={i} className="flex max-w-[92%] flex-col gap-1.5">
                  {m.actions && m.actions.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="What Jarvis did">
                      {m.actions.map((a, k) => (
                        <li key={k} className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent">
                          <Check size={12} aria-hidden /> {a}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content || <span className="text-label-3">Thinking…</span>}</p>
                </div>
              ),
            )}
          </div>
        </GlassSurface>
      )}
      {error && (
        <p role="alert" className="pointer-events-auto rounded-full bg-[var(--card-solid)] px-3 py-1.5 text-[13px] text-red shadow-apple">
          {error}
        </p>
      )}
      {voiceMenu && (
        <GlassSurface as="div" radius={22} contrast="high" className="pointer-events-auto flex w-full max-w-[640px] flex-wrap items-center gap-2 p-3 text-[14px]">
          {!premium && localSpeech.supported() && (
            <div className="flex w-full flex-wrap items-center gap-2 border-b border-separator pb-2.5">
              <span className="font-medium">Natural voice and hearing</span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(localOn)}
                onClick={() => {
                  const next = !localOn;
                  setLocalOn(next);
                  setOfferLocal(false);
                  store.set("jarvis.local", next ? "1" : "0");
                }}
                className={clsx("h-7 rounded-full px-3 text-[13px] font-semibold", localOn ? "bg-accent text-white" : "bg-fill text-label-2")}
              >
                {localOn ? "On" : "Off"}
              </button>
              {localOn && (
                <select
                  aria-label="Natural voice"
                  value={localVoice}
                  onChange={(e) => {
                    setLocalVoice(e.target.value);
                    store.set("jarvis.localVoice", e.target.value);
                  }}
                  className="h-8 rounded-full border-0 bg-fill px-3 text-[13px]"
                >
                  {LOCAL_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              )}
              <p className="w-full text-[12px] text-label-2">
                {!localOn
                  ? `Runs on this device with open models: a human-sounding British voice and accurate transcription, free, no account. About ${localMb} MB to download once.`
                  : local.tts === "failed" || local.stt === "failed"
                    ? `Couldn't load (${local.error ?? "unknown error"}). Using the browser voice.`
                    : local.tts === "ready" && local.stt === "ready"
                      ? "Ready. Speech is made and transcribed on this device; nothing is sent anywhere. Romanian replies still use the browser's Romanian voice."
                      : `Downloading once (about ${localMb} MB): voice ${Math.round(local.ttsProgress * 100)}%, hearing ${Math.round(local.sttProgress * 100)}%.`}
              </p>
            </div>
          )}
          <label htmlFor="jarvis-voice" className="font-medium">
            {premium || engine === "local" ? "Fallback browser voice" : `${ASSISTANT_NAME}'s voice on this device`}
          </label>
          <select
            id="jarvis-voice"
            value={voiceName ?? ""}
            onChange={(e) => chooseVoice(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-full border-0 bg-fill px-3 text-[14px]"
          >
            {voices.length === 0 && <option value="">No {lang === "en-GB" ? "English" : "Romanian"} voices on this device</option>}
            {voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => say(lang === "en-GB" ? "Good evening, sir. All systems are ready when you are." : "Bună seara. Totul este pregătit când sunteți gata.")}
            className="rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-white"
          >
            Test
          </button>
          <button type="button" aria-label="Close voice settings" onClick={() => setVoiceMenu(false)} className="grid size-8 place-items-center rounded-full text-label-2 hover:bg-fill">
            <X size={14} aria-hidden />
          </button>
          <p className="w-full text-[12px] text-label-2">
            {premium ? "Jarvis speaks with ElevenLabs (change the voice in Settings → Jarvis voice); this browser voice is only the fallback." : "Browser voices come from your device and sound robotic; they are used only when the natural voice isn't available."}
          </p>
        </GlassSurface>
      )}
      {localOn && !premium && (local.tts === "loading" || local.stt === "loading") && (
        <p role="status" className="pointer-events-auto rounded-full bg-[var(--card-solid)] px-3 py-1.5 text-[12px] text-label-2 shadow-apple">
          Getting {ASSISTANT_NAME}&apos;s natural voice ready… {Math.round(((local.ttsProgress + local.sttProgress) / 2) * 100)}%
        </p>
      )}
      {offerLocal && !open && (
        <GlassSurface as="div" radius={22} contrast="high" lens="always" className="pointer-events-auto flex max-w-[640px] items-center gap-2 py-1.5 pr-1.5 pl-4 text-[13px]">
          <span>Give {ASSISTANT_NAME} a natural voice on this phone? One {localMb} MB download; Wi-Fi recommended.</span>
          <button
            type="button"
            onClick={() => {
              setLocalOn(true);
              setOfferLocal(false);
              store.set("jarvis.local", "1");
            }}
            className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-white"
          >
            Turn on
          </button>
          <button
            type="button"
            aria-label="Not now"
            onClick={() => {
              setOfferLocal(false);
              store.set("jarvis.local", "0");
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-label-2 hover:bg-fill"
          >
            <X size={14} aria-hidden />
          </button>
        </GlassSurface>
      )}
      {offerBriefing && !open && (
        <GlassSurface as="div" shape="capsule" contrast="high" className="pointer-events-auto flex items-center gap-1 py-1 pr-1 pl-4 text-[14px]">
          <span>Good morning. Shall I brief you on the day?</span>
          <button type="button" onClick={brief} className="rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-white">
            Brief me
          </button>
          <button
            type="button"
            aria-label="Not today"
            onClick={() => {
              setOfferBriefing(false);
              store.set("jarvis.briefed", todayKey());
            }}
            className="grid size-8 place-items-center rounded-full text-label-2 hover:bg-fill"
          >
            <X size={14} aria-hidden />
          </button>
        </GlassSurface>
      )}
      <GlassSurface
        as="form"
        shape="capsule"
        contrast="high"
        lens="always"
        className={clsx("jarvis-bar pointer-events-auto flex w-full max-w-[640px] items-center gap-1 p-1.5", active && "is-active")}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <button
          type="button"
          onClick={listen}
          disabled={!canListen || busy}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : `Talk to ${ASSISTANT_NAME}`}
          title={canListen ? undefined : "Voice input needs Chrome, Edge or Safari"}
          className={clsx("jarvis-mic grid size-10 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-40", listening ? "bg-red" : "bg-accent")}
        >
          <Mic size={18} aria-hidden />
        </button>
        <label htmlFor="jarvis-input" className="sr-only">
          Ask {ASSISTANT_NAME}
        </label>
        <input
          id="jarvis-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => messages.length && setOpen(true)}
          placeholder={transcribing ? "Understanding…" : listening ? "Listening…" : wakeOn ? `Say “${ASSISTANT_NAME}…” or type` : `Ask ${ASSISTANT_NAME} anything`}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-label-3"
        />
        <kbd aria-hidden className="shrink-0 rounded-[5px] px-1 font-sans text-[11px] text-label-3 shadow-[inset_0_0_0_1px_var(--separator)] max-md:hidden">
          ⌘J
        </kbd>
        <button type="button" onClick={brief} disabled={busy} aria-label="Morning briefing" title="Morning briefing" className="grid size-8 shrink-0 place-items-center rounded-full text-label-2 hover:bg-fill disabled:opacity-40">
          <Sunrise size={16} aria-hidden />
        </button>
        {canListen && (
          <button
            type="button"
            onClick={toggleWake}
            aria-pressed={wakeOn}
            aria-label={wakeOn ? `Stop listening for “${ASSISTANT_NAME}”` : `Listen for “${ASSISTANT_NAME}”`}
            title={wakeOn ? "Listening for “Jarvis” while this tab is open" : "Wake word: say “Jarvis” (the browser's speech service hears the microphone while this is on)"}
            className={clsx("grid size-8 shrink-0 place-items-center rounded-full hover:bg-fill max-sm:hidden", wakeOn ? "text-accent" : "text-label-2")}
          >
            {wakeOn ? <Ear size={16} aria-hidden /> : <EarOff size={16} aria-hidden />}
          </button>
        )}
        <button type="button" onClick={toggleLang} aria-label={`Language: ${lang === "ro-RO" ? "Romanian" : "English"}. Switch`} className="h-8 shrink-0 rounded-full px-2 text-[12px] font-semibold text-label-2 hover:bg-fill">
          {lang === "ro-RO" ? "RO" : "EN"}
        </button>
        <button
          type="button"
          onClick={() => setVoiceMenu((v) => !v)}
          aria-expanded={voiceMenu}
          aria-label="Choose Jarvis's voice"
          title={voiceName ? `Voice: ${voiceName}` : "Choose a voice"}
          className="grid size-8 shrink-0 place-items-center rounded-full text-label-2 hover:bg-fill"
        >
          <AudioLines size={16} aria-hidden />
        </button>
        <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Turn spoken replies on" : "Turn spoken replies off"} className="grid size-8 shrink-0 place-items-center rounded-full text-label-2 hover:bg-fill max-sm:hidden">
          {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
        </button>
        {busy || speaking ? (
          <button type="button" onClick={stopAll} aria-label="Stop" className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-label">
            <Square size={14} aria-hidden fill="currentColor" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-label transition disabled:opacity-35">
            <ArrowUp size={18} aria-hidden />
          </button>
        )}
      </GlassSurface>
    </div>
  );
}
