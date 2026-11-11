"use client";
// Jarvis: the assistant bar on every Dashboard page. Speak (browser speech recognition) or type; Claude answers
// through /api/ai/jarvis and the reply is read aloud sentence by sentence as it streams in.
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, Mic, Square, Volume2, VolumeX, X } from "lucide-react";
import { ASSISTANT_NAME } from "@/lib/brand";
import { GlassSurface } from "./glass";

type Msg = { role: "user" | "assistant"; content: string };
type Lang = "ro-RO" | "en-US";

// The Web Speech API isn't in TypeScript's DOM types yet.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
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

/** Speaks text in order; a new reply cancels whatever is still being read. */
function useSpeaker(lang: Lang, muted: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const queue = useRef(0);
  const say = useCallback(
    (text: string) => {
      if (muted || typeof speechSynthesis === "undefined" || !text.trim()) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
      if (voice) u.voice = voice;
      u.rate = 1.04;
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
  return { say, stop, speaking };
}

export function Jarvis() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("ro-RO");
  const [muted, setMuted] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rec = useRef<Recognition | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { say, stop: stopSpeaking, speaking } = useSpeaker(lang, muted);

  useEffect(() => {
    setCanListen(Boolean(recognitionCtor()));
    const l = store.get("jarvis.lang");
    if (l === "en-US" || l === "ro-RO") setLang(l);
    setMuted(store.get("jarvis.muted") === "1");
  }, []);

  // ⌘J / Ctrl+J focuses Jarvis from anywhere; Escape closes the conversation.
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
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      stopSpeaking();
      setError(null);
      setInput("");
      setOpen(true);
      const history: Msg[] = [...messages, { role: "user" as const, content: q }].slice(-10);
      setMessages([...history, { role: "assistant", content: "" }]);
      setBusy(true);
      abort.current = new AbortController();
      let full = "";
      let spoken = 0;
      // Speak each finished sentence while the rest is still arriving.
      const speakReady = (final: boolean) => {
        const rest = full.slice(spoken);
        const m = final ? rest.length : Math.max(rest.lastIndexOf(". "), rest.lastIndexOf("? "), rest.lastIndexOf("! "), rest.lastIndexOf("\n")) + 1;
        if (m > 0) {
          say(rest.slice(0, m));
          spoken += m;
        }
      };
      try {
        const res = await fetch("/api/ai/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: abort.current.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `Jarvis couldn't answer (${res.status}).`);
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
            const ev = JSON.parse(line) as { type: string; text?: string; error?: string };
            if (ev.type === "text" && ev.text) {
              full += ev.text;
              setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
              speakReady(false);
            } else if (ev.type === "error") throw new Error(ev.error);
          }
        }
        speakReady(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
        setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -1) : m));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, messages, say, stopSpeaking],
  );

  const listen = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
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

  const stopAll = () => {
    abort.current?.abort();
    rec.current?.abort();
    stopSpeaking();
  };

  const toggleLang = () => {
    const next: Lang = lang === "ro-RO" ? "en-US" : "ro-RO";
    setLang(next);
    store.set("jarvis.lang", next);
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    store.set("jarvis.muted", next ? "1" : "0");
    if (next) stopSpeaking();
  };

  const active = busy || listening || speaking;
  return (
    <div className="jarvis pointer-events-none fixed inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+80px)] z-40 flex flex-col items-center gap-2 md:bottom-5 md:left-[calc(64px+24px)] lg:left-[calc(236px+24px)]">
      {open && messages.length > 0 && (
        <GlassSurface
          as="section"
          contrast="high"
          radius={24}
          aria-label={`Conversation with ${ASSISTANT_NAME}`}
          className="jarvis-panel pointer-events-auto w-full max-w-[640px]"
          onKeyDown={(e: React.KeyboardEvent) => e.key === "Escape" && setOpen(false)}
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="text-[13px] font-semibold text-label-2">{ASSISTANT_NAME}</p>
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
                <p key={i} className="max-w-[92%] text-[15px] leading-relaxed whitespace-pre-wrap">
                  {m.content || <span className="text-label-3">Thinking…</span>}
                </p>
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
      <GlassSurface
        as="form"
        shape="capsule"
        contrast="high"
        className={clsx("jarvis-bar pointer-events-auto flex w-full max-w-[640px] items-center gap-1.5 p-1.5", active && "is-active")}
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
          placeholder={listening ? "Listening…" : `Ask ${ASSISTANT_NAME} anything`}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-label-3"
        />
        <kbd aria-hidden className="shrink-0 rounded-[5px] px-1 font-sans text-[11px] text-label-3 shadow-[inset_0_0_0_1px_var(--separator)] max-md:hidden">⌘J</kbd>
        <button type="button" onClick={toggleLang} aria-label={`Language: ${lang === "ro-RO" ? "Romanian" : "English"}. Switch`} className="h-8 shrink-0 rounded-full px-2 text-[12px] font-semibold text-label-2 hover:bg-fill">
          {lang === "ro-RO" ? "RO" : "EN"}
        </button>
        <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Turn spoken replies on" : "Turn spoken replies off"} className="grid size-8 shrink-0 place-items-center rounded-full text-label-2 hover:bg-fill">
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
