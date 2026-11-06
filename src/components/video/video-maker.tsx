"use client";
// AI video maker on the reel page: the client's input (brief + profile + plan + footage) → Opus writes a VideoSpec
// using the Reels Brain → live preview (Remotion Player) → MP4 rendered in this browser (no server, no upload unless asked).
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { ChevronDown, ChevronUp, Clapperboard, ClipboardCopy, Download, ExternalLink, ImagePlus, LoaderCircle, Plus, Sparkles, Trash2, TriangleAlert, Upload, Wrench } from "lucide-react";
import { attachFile, saveReelVideo } from "@/app/actions/clients";
import { extractJson } from "@/lib/ai/extract-json";
import type { DriveFile } from "@/lib/db/schema";
import { FONTS, FPS, HEIGHT, LOOKS, lintSpec, MOODS, scene, SCENE_KINDS, SFX, TRANSITIONS, totalFrames, videoSpec, WIDTH, type Attachment, type Lint, type Scene, type VideoSpec } from "@/lib/video/spec";
import { uploadToDrive } from "../drive-files";
import { buttonClass, Card, Field, Notice } from "../ui";
import { ReelComposition } from "./reel-composition";

type Props = {
  reelId: number;
  clientId: number;
  title: string;
  files: DriveFile[];
  googleConnected: boolean;
  claudeConfigured: boolean;
  initial: { brief?: string; spec?: unknown };
};

const blankScene = (): Scene => scene.parse({ kind: "statement", title: "New point", transition: "push" });

/** Reads duration and size of a clip/photo so Opus can plan around it. */
function probe(url: string, kind: "video" | "image"): Promise<{ duration?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (kind === "image") {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
      return;
    }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => resolve({ duration: Number.isFinite(v.duration) ? v.duration : undefined, width: v.videoWidth || undefined, height: v.videoHeight || undefined });
    v.onerror = () => resolve({});
    v.src = url;
  });
}

export default function VideoMaker({ reelId, clientId, title, files, googleConnected, claudeConfigured, initial }: Props) {
  const [brief, setBrief] = useState(initial.brief ?? "");
  const [spec, setSpec] = useState<VideoSpec | null>(() => {
    const r = videoSpec.safeParse(initial.spec);
    return r.success && r.data.scenes.length ? r.data : null;
  });
  const [source, setSource] = useState(""); // text the stat check compares against
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState<"" | "ai" | "render" | "upload">("");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [support, setSupport] = useState<string>("");
  const [open, setOpen] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  // Drive files already attached to this reel become available as footage (streamed through /api/drive/media).
  useEffect(() => {
    let alive = true;
    const media = files.filter((f) => f.mimeType.startsWith("video/") || f.mimeType.startsWith("image/"));
    Promise.all(
      media.map(async (f) => {
        const kind = f.mimeType.startsWith("video/") ? "video" : "image";
        const url = `/api/drive/media/${f.id}`;
        return { id: `drive-${f.id.slice(0, 10)}`, name: f.name, kind, url, ...(await probe(url, kind)) } as Attachment;
      }),
    ).then((list) => alive && setAttachments((cur) => [...cur.filter((a) => !a.id.startsWith("drive-")), ...list]));
    return () => {
      alive = false;
    };
  }, [files]);

  const linted = useMemo(() => (spec ? lintSpec(spec, `${source}\n${brief}`, attachments) : null), [spec, source, brief, attachments]);
  const view = linted?.spec ?? null;
  const lints: Lint[] = linted?.lints ?? [];
  const frames = view ? totalFrames(view) : FPS;

  // Save brief + spec shortly after they change.
  useEffect(() => {
    const t = setTimeout(() => {
      saveReelVideo(reelId, { brief, spec: spec ?? undefined }).catch(() => setError("Couldn't save the video draft."));
    }, 1200);
    return () => clearTimeout(t);
  }, [reelId, brief, spec]);

  async function addLocal(list: FileList | null) {
    if (!list) return;
    const next: Attachment[] = [];
    for (const f of Array.from(list)) {
      const kind = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
      if (!kind) continue;
      const url = URL.createObjectURL(f);
      counter.current += 1;
      next.push({ id: `${kind === "video" ? "clip" : "photo"}-${counter.current}`, name: f.name, kind, url, ...(await probe(url, kind)) });
    }
    setAttachments((cur) => [...cur, ...next]);
  }

  async function generate() {
    setBusy("ai");
    setError("");
    setPrompt("");
    try {
      const res = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId, brief, attachments: attachments.map(({ url: _u, ...a }) => ({ ...a, url: "" })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The AI request failed.");
      if (data.prompt) {
        setPrompt(data.prompt);
        setSource(data.prompt);
        await navigator.clipboard.writeText(data.prompt).catch(() => {});
      } else {
        setSource(data.context ?? "");
        setSpec(data.spec);
        setResult(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  function importReply() {
    const json = extractJson(reply);
    const r = json ? videoSpec.safeParse(json) : null;
    if (!r?.success || !r.data.scenes.length) {
      setError("Couldn't find a video spec in that reply. Paste Claude's whole answer, including the ```json block.");
      return;
    }
    setSpec(r.data);
    setReply("");
    setPrompt("");
    setResult(null);
    setError("");
  }

  const edit = (fn: (s: VideoSpec) => void) =>
    setSpec((cur) => {
      if (!cur) return cur;
      const next = structuredClone(cur);
      fn(next);
      return next;
    });
  const editScene = (i: number, patch: Partial<Scene>) => edit((s) => Object.assign(s.scenes[i], patch));

  async function exportMp4() {
    if (!view) return;
    setBusy("render");
    setError("");
    setProgress(0);
    setResult(null);
    try {
      const props = { spec: view, attachments };
      const composition = { id: "ai-reel", component: ReelComposition, durationInFrames: frames, fps: FPS, width: WIDTH, height: HEIGHT, calculateMetadata: null, defaultProps: props };
      const can = await canRenderMediaOnWeb({ container: "mp4", videoCodec: "h264", width: WIDTH, height: HEIGHT });
      if (!can.canRender) throw new Error(`This browser can't render MP4 here (${can.issues.map((i) => i.message).join("; ")}). Use Chrome or Firefox.`);
      const { getBlob } = await renderMediaOnWeb({
        composition,
        inputProps: props,
        container: "mp4",
        videoCodec: "h264",
        videoBitrate: "high",
        licenseKey: "free-license",
        onProgress: ({ progress: p }) => setProgress(p),
      });
      const blob = await getBlob();
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function saveToDrive() {
    if (!result) return;
    setBusy("upload");
    setError("");
    try {
      const blob = await (await fetch(result.url)).blob();
      const name = `${slug(title || "reel")}-ai-${new Date().toISOString().slice(0, 10)}.mp4`;
      const { id } = await uploadToDrive(new File([blob], name, { type: "video/mp4" }), { clientId, section: "Reels", onProgress: setProgress });
      await attachFile("reel", reelId, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    canRenderMediaOnWeb({ container: "mp4", videoCodec: "h264", width: WIDTH, height: HEIGHT })
      .then((c) => setSupport(c.canRender ? "" : "This browser can't export MP4 here. The preview still works; export from Chrome or Firefox."))
      .catch(() => setSupport(""));
  }, []);

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Clapperboard size={16} className="text-accent" />
        <p className="flex-1 text-[15px] font-semibold">AI video</p>
        <span className="text-[12px] text-label-2">Opus 5.5 + Reels Brain · renders in your browser</span>
      </div>

      <Field label="Client input" hint="What the client sent: the message, the offer, facts and numbers you may use, links. The reel's hook, script, plan and the client profile are included automatically.">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} className="field" placeholder="e.g. New spring menu, 3 dishes, launch Friday 10 May, 15% off the first week. Calm, premium tone. Footage: kitchen B-roll + plating." />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="flex-1 text-[13px] font-medium text-label-2">Footage ({attachments.length})</p>
          <button type="button" className={buttonClass("gray", "sm")} onClick={() => fileInput.current?.click()}>
            <ImagePlus size={13} /> Add clips or photos
          </button>
          <input ref={fileInput} type="file" accept="video/*,image/*" multiple hidden onChange={(e) => addLocal(e.target.files).then(() => (e.target.value = ""))} />
        </div>
        {attachments.length ? (
          <ul className="space-y-1.5">
            {attachments.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 text-[13px]">
                <span className="w-16 shrink-0 font-mono text-[11px] text-label-2">{a.id}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.name}
                  <span className="text-label-2">
                    {" "}
                    · {a.kind}
                    {a.duration ? ` · ${a.duration.toFixed(1)} s` : ""}
                    {a.width ? ` · ${a.width}×${a.height}` : ""}
                  </span>
                </span>
                <input value={a.note ?? ""} onChange={(e) => setAttachments((cur) => cur.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))} placeholder="what's in it" className="field !w-40 !py-1 text-[12px]" />
                {!a.id.startsWith("drive-") && (
                  <button type="button" aria-label="Remove" className={buttonClass("plain", "sm")} onClick={() => setAttachments((cur) => cur.filter((_, k) => k !== i))}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-label-2">No footage: Opus makes a motion-led video from the text. Clips you add stay in this browser; Drive files on this reel are included automatically.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass("filled")} disabled={busy !== ""} onClick={generate}>
          {busy === "ai" ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {spec ? "Make a new version" : "Make the video"}
        </button>
        {!claudeConfigured && <span className="text-[12px] text-label-2">No API key: you'll get a prompt for the Claude app, then paste the reply here.</span>}
      </div>

      {prompt && (
        <div className="space-y-2 rounded-2xl bg-fill p-3">
          <p className="text-[13px]">The prompt is copied. Paste it into Claude (Opus 5.5), then paste the whole reply below.</p>
          <div className="flex gap-2">
            <button type="button" className={buttonClass("gray", "sm")} onClick={() => navigator.clipboard.writeText(prompt)}>
              <ClipboardCopy size={13} /> Copy again
            </button>
            <a className={buttonClass("gray", "sm")} href="https://claude.ai/new" target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Open Claude
            </a>
          </div>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} className="field" placeholder="Paste Claude's reply (with the ```json block)" />
          <button type="button" className={buttonClass("tinted", "sm")} disabled={!reply.trim()} onClick={importReply}>
            Use this video
          </button>
        </div>
      )}

      {error && <Notice tone="red">{error}</Notice>}

      {view && (
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            <div className="overflow-hidden rounded-[22px] bg-black shadow-lg">
              <Player
                component={ReelComposition}
                inputProps={{ spec: view, attachments }}
                durationInFrames={frames}
                fps={FPS}
                compositionWidth={WIDTH}
                compositionHeight={HEIGHT}
                style={{ width: "100%", aspectRatio: "9 / 16" }}
                controls
                loop
                acknowledgeRemotionLicense
              />
            </div>
            <p className="text-center text-[12px] text-label-2">
              {(frames / FPS).toFixed(1)} s · {view.scenes.length} scenes · {view.music.mood} music
            </p>
            {support && <Notice tone="orange">{support}</Notice>}
            <button type="button" className={buttonClass("filled", "md") + " w-full"} disabled={busy !== ""} onClick={exportMp4}>
              {busy === "render" ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}
              {busy === "render" ? `Rendering ${Math.round(progress * 100)}%` : "Export MP4 (1080×1920)"}
            </button>
            {result && (
              <div className="flex gap-2">
                <a className={buttonClass("tinted", "sm") + " flex-1"} href={result.url} download={`${slug(title || "reel")}-ai.mp4`}>
                  <Download size={13} /> Download ({(result.size / 1e6).toFixed(1)} MB)
                </a>
                {googleConnected && (
                  <button type="button" className={buttonClass("gray", "sm") + " flex-1"} disabled={busy !== ""} onClick={saveToDrive}>
                    {busy === "upload" ? <LoaderCircle size={13} className="animate-spin" /> : <Upload size={13} />} To Drive
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            {lints.length > 0 && (
              <div className="space-y-1 rounded-2xl bg-fill p-3 text-[12px]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Wrench size={13} /> Reels Brain checks
                </p>
                {lints.map((l, i) => (
                  <p key={i} className={l.level === "warn" ? "text-orange" : "text-label-2"}>
                    {l.level === "warn" ? <TriangleAlert size={11} className="mr-1 inline" /> : "✓ "}
                    {l.scene !== undefined ? `Scene ${l.scene + 1}: ` : ""}
                    {l.text}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-label-2">Look</span>
                <select className="field !py-1" value={view.theme.look} onChange={(e) => edit((s) => (s.theme.look = e.target.value as VideoSpec["theme"]["look"]))}>
                  {LOOKS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-label-2">Font</span>
                <select className="field !py-1" value={view.theme.font} onChange={(e) => edit((s) => (s.theme.font = e.target.value as VideoSpec["theme"]["font"]))}>
                  {FONTS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-label-2">Music</span>
                <select className="field !py-1" value={view.music.mood} onChange={(e) => edit((s) => (s.music.mood = e.target.value as VideoSpec["music"]["mood"]))}>
                  {MOODS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-label-2">Colours</span>
                <span className="flex gap-1">
                  <input type="color" value={view.theme.accent} onChange={(e) => edit((s) => (s.theme.accent = e.target.value))} className="h-8 w-full rounded-lg" />
                  <input type="color" value={view.theme.accent2} onChange={(e) => edit((s) => (s.theme.accent2 = e.target.value))} className="h-8 w-full rounded-lg" />
                </span>
              </label>
            </div>
            <label className="block space-y-1 text-[12px]">
              <span className="text-label-2">Handle on the CTA card</span>
              <input className="field !py-1" value={view.handle} onChange={(e) => edit((s) => (s.handle = e.target.value))} placeholder="@client" />
            </label>

            <ol className="space-y-1.5">
              {view.scenes.map((s, i) => (
                <li key={i} className="rounded-2xl bg-fill/60 p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-[12px] font-semibold text-label-2">{i + 1}</span>
                    <select className="field !w-auto !py-0.5 text-[12px]" value={s.kind} onChange={(e) => editScene(i, { kind: e.target.value as Scene["kind"] })}>
                      {SCENE_KINDS.map((k) => <option key={k}>{k}</option>)}
                    </select>
                    <input className="field !py-0.5 min-w-0 flex-1 text-[13px] font-medium" value={spec?.scenes[i]?.title ?? s.title} onChange={(e) => editScene(i, { title: e.target.value })} />
                    <span className="text-[11px] tabular-nums text-label-2">{s.duration.toFixed(1)} s</span>
                    <button type="button" aria-label="Details" className={buttonClass("plain", "sm")} onClick={() => setOpen(open === i ? null : i)}>
                      {open === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                  {open === i && spec?.scenes[i] && (
                    <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2">
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-label-2">Subtitle</span>
                        <input className="field !py-1" value={spec.scenes[i].subtitle} onChange={(e) => editScene(i, { subtitle: e.target.value })} />
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-label-2">Caption band</span>
                        <input className="field !py-1" value={spec.scenes[i].caption} onChange={(e) => editScene(i, { caption: e.target.value })} />
                      </label>
                      {(s.kind === "list" || s.kind === "steps" || s.kind === "compare") && (
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-label-2">Items (one per line)</span>
                          <textarea className="field !py-1" rows={3} value={spec.scenes[i].items.join("\n")} onChange={(e) => editScene(i, { items: e.target.value.split("\n").slice(0, 5) })} />
                        </label>
                      )}
                      {s.kind === "stat" && (
                        <label className="space-y-1">
                          <span className="text-label-2">Value · label</span>
                          <span className="flex gap-1">
                            <input className="field !py-1" value={spec.scenes[i].value} onChange={(e) => editScene(i, { value: e.target.value })} />
                            <input className="field !py-1" value={spec.scenes[i].label} onChange={(e) => editScene(i, { label: e.target.value })} />
                          </span>
                        </label>
                      )}
                      <label className="space-y-1">
                        <span className="text-label-2">Accent word</span>
                        <input className="field !py-1" value={spec.scenes[i].emphasis} onChange={(e) => editScene(i, { emphasis: e.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-label-2">Seconds</span>
                        <input type="number" min={0.8} max={12} step={0.1} className="field !py-1" value={spec.scenes[i].duration} onChange={(e) => editScene(i, { duration: Number(e.target.value) || 2 })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-label-2">Enters with</span>
                        <select className="field !py-1" value={spec.scenes[i].transition} onChange={(e) => editScene(i, { transition: e.target.value as Scene["transition"] })}>
                          {TRANSITIONS.map((k) => <option key={k}>{k}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-label-2">Sound</span>
                        <select className="field !py-1" value={spec.scenes[i].sfx} onChange={(e) => editScene(i, { sfx: e.target.value as Scene["sfx"] })}>
                          {SFX.map((k) => <option key={k}>{k}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-label-2">Footage</span>
                        <select
                          className="field !py-1"
                          value={spec.scenes[i].media?.ref ?? ""}
                          onChange={(e) => editScene(i, { media: e.target.value ? { ref: e.target.value, fit: "cover", move: "in", from: 0 } : null })}
                        >
                          <option value="">none</option>
                          {attachments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.id} · {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end gap-1">
                        <button type="button" className={buttonClass("gray", "sm")} disabled={i === 0} onClick={() => edit((v) => v.scenes.splice(i - 1, 0, ...v.scenes.splice(i, 1)))}>
                          <ChevronUp size={12} />
                        </button>
                        <button type="button" className={buttonClass("gray", "sm")} disabled={i === view.scenes.length - 1} onClick={() => edit((v) => v.scenes.splice(i + 1, 0, ...v.scenes.splice(i, 1)))}>
                          <ChevronDown size={12} />
                        </button>
                        <button type="button" className={buttonClass("destructive", "sm")} onClick={() => { edit((v) => void v.scenes.splice(i, 1)); setOpen(null); }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <button type="button" className={buttonClass("plain", "sm")} onClick={() => edit((v) => void v.scenes.splice(Math.max(0, v.scenes.length - 1), 0, blankScene()))}>
              <Plus size={13} /> Add scene
            </button>

            {(view.postCaption || view.notes) && (
              <div className="space-y-2 text-[13px]">
                {view.postCaption && (
                  <div className="rounded-2xl bg-fill p-3">
                    <p className="mb-1 text-[12px] font-semibold text-label-2">Post caption</p>
                    <p className="whitespace-pre-wrap">{view.postCaption}</p>
                    {view.hashtags.length > 0 && <p className="mt-1 text-accent">{view.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>}
                    <button type="button" className={buttonClass("plain", "sm") + " mt-1"} onClick={() => navigator.clipboard.writeText(`${view.postCaption}\n\n${view.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`)}>
                      <ClipboardCopy size={12} /> Copy
                    </button>
                  </div>
                )}
                {view.notes && (
                  <details className="rounded-2xl bg-fill p-3">
                    <summary className="cursor-pointer text-[12px] font-semibold text-label-2">Opus's notes: rules applied and what to check</summary>
                    <p className="mt-1 whitespace-pre-wrap">{view.notes}</p>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "reel";
