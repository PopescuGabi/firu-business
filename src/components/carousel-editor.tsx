"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import clsx from "clsx";
import { toBlob } from "html-to-image";
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Download, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { attachFile, deleteCarousel, saveCarousel } from "@/app/actions/clients";
import type { CarouselTheme, DriveFile, Slide } from "@/lib/db/schema";
import { ClaudePanel, type ChatMessage } from "./claude-panel";
import { DriveFiles, uploadToDrive } from "./drive-files";
import { SlidePreview } from "./slide-preview";
import { buttonClass, Card, Field, segmentClass, segmentGroupClass, STATUS_COLORS, statusLabel } from "./ui";
import { SaveIndicator, useAutosave } from "./use-autosave";

type Carousel = {
  id: number;
  clientId: number;
  title: string;
  status: string;
  caption: string;
  postDate: string | null;
  slides: Slide[];
  theme: CarouselTheme;
  files: DriveFile[];
};
type Fields = Pick<Carousel, "title" | "status" | "caption" | "postDate" | "slides" | "theme">;

const STATUSES = ["draft", "review", "approved", "posted"] as const;
const newId = () => Math.random().toString(36).slice(2, 10);
const pick = (c: Carousel): Fields => ({
  title: c.title,
  status: c.status,
  caption: c.caption,
  postDate: c.postDate,
  slides: c.slides,
  theme: c.theme,
});

export function CarouselEditor({
  carousel,
  clientName,
  messages,
  prompts,
  claudeConfigured,
  googleConnected,
}: {
  carousel: Carousel;
  clientName: string;
  messages: ChatMessage[];
  prompts: { id: number; name: string; category: string }[];
  claudeConfigured: boolean;
  googleConnected: boolean;
}) {
  const [f, setF] = useState<Fields>(pick(carousel));
  const [sel, setSel] = useState(0);
  const [files, setFiles] = useState(carousel.files);
  const [exporting, setExporting] = useState<string | null>(null);
  const [filesKey, setFilesKey] = useState(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const { state, reset } = useAutosave(f, (v) =>
    saveCarousel(carousel.id, { ...v, status: v.status as (typeof STATUSES)[number], title: v.title.trim() || "Untitled carousel" }),
  );

  const slide = f.slides[Math.min(sel, f.slides.length - 1)];
  const setSlides = (slides: Slide[]) => setF((x) => ({ ...x, slides }));
  const setSlide = (patch: Partial<Slide>) => setSlides(f.slides.map((s, i) => (i === sel ? { ...s, ...patch } : s)));
  const setTheme = (patch: Partial<CarouselTheme>) => setF((x) => ({ ...x, theme: { ...x.theme, ...patch } }));
  const move = (dir: -1 | 1) => {
    const j = sel + dir;
    if (j < 0 || j >= f.slides.length) return;
    const next = [...f.slides];
    [next[sel], next[j]] = [next[j], next[sel]];
    setSlides(next);
    setSel(j);
  };

  async function renderPngs() {
    const nodes = Array.from(exportRef.current?.children ?? []) as HTMLElement[];
    const blobs: Blob[] = [];
    for (const node of nodes) {
      const blob = await toBlob(node, { width: 1080, height: 1350, pixelRatio: 1, cacheBust: true });
      if (!blob) throw new Error("Could not render slide");
      blobs.push(blob);
    }
    return blobs;
  }
  const fileBase = (f.title.trim() || "carousel").replace(/[^\w\-ăâîșțĂÂÎȘȚ ]+/g, "").replace(/\s+/g, "-");

  async function download() {
    setExporting("Rendering…");
    try {
      const blobs = await renderPngs();
      blobs.forEach((b, i) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${fileBase}-${String(i + 1).padStart(2, "0")}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
    } finally {
      setExporting(null);
    }
  }

  async function saveToDrive() {
    try {
      setExporting("Rendering…");
      const blobs = await renderPngs();
      let latest = files;
      for (const [i, b] of blobs.entries()) {
        setExporting(`Uploading ${i + 1}/${blobs.length}…`);
        const up = await uploadToDrive(b, {
          clientId: carousel.clientId,
          section: "Carousels",
          name: `${fileBase}-${String(i + 1).padStart(2, "0")}.png`,
        });
        latest = await attachFile("carousel", carousel.id, up.id);
      }
      setFiles(latest);
      setFilesKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/clients/${carousel.clientId}?tab=carousels`} className="flex items-center text-[15px] text-blue">
          <ChevronLeft size={20} /> {clientName} carousels
        </Link>
        <div className="flex items-center gap-3">
          <SaveIndicator state={state} />
          <a href="#opus" className={buttonClass("tinted", "sm") + " xl:hidden"}>
            <Sparkles size={14} /> Ask Opus
          </a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          <input
            value={f.title}
            onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))}
            aria-label="Carousel title"
            className="w-full bg-transparent text-[28px] font-bold tracking-tight outline-none placeholder:text-label-3"
            placeholder="Carousel title"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1 rounded-[20px] bg-fill p-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={f.status === s}
                  onClick={() => setF((x) => ({ ...x, status: s }))}
                  className="h-7 cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors duration-200"
                  style={f.status === s ? { background: `color-mix(in srgb, ${STATUS_COLORS[s]} 18%, var(--card-solid))`, color: STATUS_COLORS[s], fontWeight: 600 } : { color: "var(--label-2)" }}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-label-2">
              Post date
              <input type="date" value={f.postDate ?? ""} onChange={(e) => setF((x) => ({ ...x, postDate: e.target.value || null }))} className="field !w-auto !py-1" />
            </label>
          </div>

          {/* Slide strip */}
          <div className="-mx-1 flex gap-2.5 overflow-x-auto p-1.5" role="listbox" aria-label="Slides">
            {f.slides.map((s, i) => (
              <button
                key={s.id}
                role="option"
                aria-selected={i === sel}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSel(i)}
                className={clsx(
                  "w-[92px] shrink-0 cursor-pointer overflow-hidden rounded-lg ring-offset-2 ring-offset-bg transition",
                  i === sel ? "ring-[3px] ring-blue" : "opacity-80 hover:opacity-100",
                )}
              >
                <SlidePreview slide={s} theme={f.theme} index={i} total={f.slides.length} />
              </button>
            ))}
            {f.slides.length < 20 && (
              <button
                aria-label="Add slide"
                onClick={() => {
                  setSlides([...f.slides, { id: newId(), heading: "", body: "", note: "" }]);
                  setSel(f.slides.length);
                }}
                className="grid aspect-[4/5] w-[92px] shrink-0 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-separator text-label-2 hover:border-blue hover:text-blue"
              >
                <Plus size={22} />
              </button>
            )}
          </div>

          {slide && (
            <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]">
              <div>
                <SlidePreview slide={slide} theme={f.theme} index={sel} total={f.slides.length} className="rounded-xl shadow-apple ring-1 ring-separator" />
                <div className="mt-2 flex justify-center gap-1">
                  <IconBtn label="Move left" onClick={() => move(-1)} disabled={sel === 0}><ArrowUp size={15} className="-rotate-90" /></IconBtn>
                  <IconBtn label="Move right" onClick={() => move(1)} disabled={sel === f.slides.length - 1}><ArrowDown size={15} className="-rotate-90" /></IconBtn>
                  <IconBtn
                    label="Duplicate slide"
                    disabled={f.slides.length >= 20}
                    onClick={() => {
                      const next = [...f.slides];
                      next.splice(sel + 1, 0, { ...slide, id: newId() });
                      setSlides(next);
                      setSel(sel + 1);
                    }}
                  >
                    <Copy size={15} />
                  </IconBtn>
                  <IconBtn
                    label="Delete slide"
                    disabled={f.slides.length <= 1}
                    onClick={() => {
                      setSlides(f.slides.filter((_, i) => i !== sel));
                      setSel(Math.max(0, sel - 1));
                    }}
                  >
                    <Trash2 size={15} />
                  </IconBtn>
                </div>
              </div>
              <Card className="space-y-4 p-4">
                <p className="text-[13px] font-semibold text-label-2">Slide {sel + 1}</p>
                <Field label="Heading">
                  <textarea value={slide.heading} onChange={(e) => setSlide({ heading: e.target.value })} rows={2} className="field" />
                </Field>
                <Field label="Body">
                  <textarea value={slide.body} onChange={(e) => setSlide({ body: e.target.value })} rows={5} className="field" />
                </Field>
                <Field label="Design note (not shown on the slide)">
                  <textarea value={slide.note} onChange={(e) => setSlide({ note: e.target.value })} rows={2} className="field" />
                </Field>
              </Card>
            </div>
          )}

          <Card className="space-y-4 p-4">
            <p className="text-[13px] font-semibold text-label-2">Style</p>
            <div className="flex flex-wrap gap-4">
              {(["background", "foreground", "accent"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-[14px] capitalize">
                  <input type="color" value={f.theme[k]} onChange={(e) => setTheme({ [k]: e.target.value })} className="size-8 cursor-pointer rounded-full border border-separator bg-transparent" />
                  {k === "foreground" ? "Text" : k}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Segment value={f.theme.font} options={["sans", "serif", "rounded"]} onChange={(font) => setTheme({ font })} label="Font" />
              <Segment value={f.theme.align} options={["left", "center"]} onChange={(align) => setTheme({ align })} label="Alignment" />
            </div>
          </Card>

          <Card className="p-4">
            <Field label="Caption">
              <textarea value={f.caption} onChange={(e) => setF((x) => ({ ...x, caption: e.target.value }))} rows={5} className="field" />
            </Field>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-[13px] font-semibold text-label-2">Export (1080×1350 PNG)</p>
              <button className={buttonClass("gray", "sm")} disabled={!!exporting} onClick={download}>
                <Download size={14} /> Download
              </button>
              {googleConnected && (
                <button className={buttonClass("tinted", "sm")} disabled={!!exporting} onClick={saveToDrive}>
                  <Upload size={14} /> Save to Drive
                </button>
              )}
            </div>
            {exporting && <p role="status" className="text-[13px] text-label-2">{exporting}</p>}
            <DriveFiles key={filesKey} clientId={carousel.clientId} section="Carousels" target="carousel" targetId={carousel.id} files={files} googleConnected={googleConnected} />
          </Card>

          <form action={deleteCarousel.bind(null, carousel.id)}>
            <button
              className={buttonClass("destructive", "sm")}
              onClick={(e) => {
                if (!confirm("Delete this carousel? Drive files stay in Drive.")) e.preventDefault();
              }}
            >
              <Trash2 size={14} /> Delete carousel
            </button>
          </form>
        </div>

        <div id="opus" className="scroll-mt-4 xl:sticky xl:top-6 xl:h-[calc(100dvh-48px)]">
          <ClaudePanel<Carousel>
            targetType="carousel"
            targetId={carousel.id}
            initialMessages={messages}
            prompts={prompts}
            claudeConfigured={claudeConfigured}
            suggestions={["Write a 7-slide carousel from my title", "Make the headings punchier", "Write the caption with a CTA"]}
            onApplied={(c) => {
              const next = pick(c);
              reset(next);
              setF(next);
              setSel(0);
            }}
            renderProposal={(p) => {
              const prop = p as { title?: string; caption?: string; slides?: { heading: string; body: string }[]; theme?: object };
              return (
                <>
                  {prop.title && <p><strong>Title:</strong> {prop.title}</p>}
                  {prop.slides && (
                    <ol className="list-decimal space-y-1 pl-4">
                      {prop.slides.map((s, i) => (
                        <li key={i}>
                          <strong>{s.heading}</strong>
                          {s.body && <span className="line-clamp-2 text-label-2">{s.body}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {prop.caption && <p className="line-clamp-4 whitespace-pre-wrap"><strong>Caption:</strong> {prop.caption}</p>}
                  {prop.theme && <p><strong>Style:</strong> updated colours / font</p>}
                </>
              );
            }}
          />
        </div>
      </div>

      {/* Full-size slides for PNG export, rendered off-screen. */}
      <div ref={exportRef} aria-hidden className="pointer-events-none fixed top-0 -left-[20000px]">
        {f.slides.map((s, i) => (
          <div key={s.id} style={{ width: 1080, height: 1350 }}>
            <SlidePreview slide={s} theme={f.theme} index={i} total={f.slides.length} />
          </div>
        ))}
      </div>
    </>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid size-8 cursor-pointer place-items-center rounded-full bg-fill text-label hover:bg-fill-2 disabled:opacity-30">
      {children}
    </button>
  );
}

function Segment<T extends string>({ value, options, onChange, label }: { value: T; options: T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx(segmentGroupClass, "p-1")}>
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={clsx("h-7 px-3 text-[13px] capitalize", segmentClass(value === o))}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
