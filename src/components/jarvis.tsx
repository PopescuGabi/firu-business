"use client";
// Jarvis: the assistant bar on every Dashboard page. Speak (browser speech recognition), type, or say "Jarvis"
// with the wake word on. Claude answers through /api/ai/jarvis, can act (plan the day, add tasks, update leads),
// and the reply is read aloud in a British voice, sentence by sentence as it streams in.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowUp, Check, Ear, EarOff, Mic, Square, Sunrise, Volume2, VolumeX, X } from "lucide-react";
import { ASSISTANT_NAME } from "@/lib/brand";
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

/** "Good morning" (or "Bună dimineața") starts the briefing. */
const BRIEFING = /^\s*(good morning|morning|brief me|bun[ăa] diminea[țt]a)\b/i;
/** What speech recognition tends to hear for "Jarvis". */
const WAKE = /\b(jarvis|jarvi[sz]|jar vis|djarvis|jarviz|jervis)\b[,.!?]?\s*/i;

// Voices that sound like a calm British assistant, best first (macOS, Chrome, Edge, Windows names).
const BRITISH = ["Daniel", "Arthur", "Google UK English Male", "Microsoft Ryan", "Microsoft George", "Oliver", "Jamie", "Malcolm"];
function pickVoice(lang: Lang) {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-");
  if (lang === "en-GB") {
    for (const name of BRITISH) {
      const v = voices.find((x) => x.name.startsWith(name) && norm(x).startsWith("en"));
      if (v) return v;
    }
    return voices.find((v) => norm(v) === "en-GB") ?? voices.find((v) => norm(v).startsWith("en")) ?? null;
  }
  return voices.find((v) => norm(v).startsWith("ro")) ?? null;
}

/** Speaks text in order; a new reply cancels whatever is still being read. */
function useSpeaker(lang: Lang, muted: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const queue = useRef(0);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const update = () => setVoiceName(pickVoice(lang)?.name ?? null);
    update();
    speechSynthesis.addEventListener("voiceschanged", update);
    return () => speechSynthesis.removeEventListener("voiceschanged", update);
  }, [lang]);
  const say = useCallback(
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
  const stop = useCallback(() => {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    queue.current = 0;
    setSpeaking(false);
  }, []);
  return { say, stop, speaking, voiceName };
}

export function Jarvis() {
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
  const { say, stop: stopSpeaking, speaking, voiceName } = useSpeaker(lang, muted);

  useEffect(() => {
    setCanListen(Boolean(recognitionCtor()));
    const l = store.get("jarvis.lang");
    if (l === "en-GB" || l === "ro-RO") setLang(l);
    setMuted(store.get("jarvis.muted") === "1");
    setWakeOn(store.get("jarvis.wake") === "1");
    // Once a day, before mid-afternoon, Jarvis offers the briefing (a click is needed before a page may speak).
    if (store.get("jarvis.briefed") !== todayKey() && new Date().getHours() < 15) setOfferBriefing(true);
  }, []);

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

  const listen = useCallback(() => {
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
  }, [ask, lang, listening, stopSpeaking]);

  // Wake word: while on, the tab listens for "Jarvis" and treats what follows as the request. It pauses while
  // Jarvis listens, thinks or speaks (so it doesn't hear itself) and whenever the tab is hidden.
  const askRef = useRef(ask);
  const listenRef = useRef(listen);
  const sayRef = useRef(say);
  useEffect(() => {
    askRef.current = ask;
    listenRef.current = listen;
    sayRef.current = say;
  }, [ask, listen, say]);
  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!wakeOn || !Ctor || busy || listening || speaking) return;
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
          if (rest.split(/\s+/).length >= 2) void askRef.current(rest);
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
  }, [wakeOn, busy, listening, speaking, lang]);

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

  const active = busy || listening || speaking;
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
              {voiceName && <span className="font-normal text-label-3"> · voice: {voiceName}</span>}
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
          placeholder={listening ? "Listening…" : wakeOn ? `Say “${ASSISTANT_NAME}…” or type` : `Ask ${ASSISTANT_NAME} anything`}
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
