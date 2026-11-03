"use client";
import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, ImagePlus, Monitor, Trash2 } from "lucide-react";
import { chooseBackground, chooseTheme, removeBackgroundPhoto, uploadBackground } from "@/app/actions/background";
import { BACKGROUNDS } from "@/lib/backgrounds";
import { applyTheme, THEMES, type ThemePref } from "@/lib/theme";
import { buttonClass, segmentClass, segmentGroupClass } from "./ui";

const LONGEST_SIDE = 2560;

/** Shrinks a photo to a sharp-enough JPEG (a few hundred KB) before it leaves the laptop. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.84));
}

type FilePicker = (opts: { startIn?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ getFile(): Promise<File> }[]>;

export function BackgroundPicker({ current, photoUrl, theme }: { current: string; photoUrl: string | null; theme: ThemePref }) {
  const [mode, setMode] = useState(theme);
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(current);
  const active = pending ? picked : current;

  const pick = (key: string) => {
    setError("");
    setPicked(key);
    start(() => chooseBackground(key));
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    setError("");
    setPicked("photo");
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("photo", new File([await shrink(file)], "background.jpg", { type: "image/jpeg" }));
        await uploadBackground(fd);
      } catch {
        setError("Couldn't use that file. HEIC photos only open in Safari; save it as JPEG or PNG, or take a screenshot and upload that.");
      }
    });
  };

  // Browsers can't read the desktop wallpaper, so open the Pictures folder (where most wallpapers live).
  const pickWallpaper = async () => {
    const showOpenFilePicker = (window as unknown as { showOpenFilePicker?: FilePicker }).showOpenFilePicker;
    if (!showOpenFilePicker) return input.current?.click();
    try {
      const [handle] = await showOpenFilePicker({
        startIn: "pictures",
        types: [{ description: "Images", accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] } }],
      });
      upload(await handle.getFile());
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) input.current?.click();
    }
  };

  const pickTheme = (t: ThemePref) => {
    setMode(t);
    applyTheme(t); // straight away; saving follows
    void chooseTheme(t);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[15px] font-medium">Theme</span>
        <div role="radiogroup" aria-label="Theme" className={clsx(segmentGroupClass, "p-1")}>
          {THEMES.map((t) => (
            <button key={t.key} type="button" role="radio" aria-checked={mode === t.key} onClick={() => pickTheme(t.key)} className={clsx("h-8 px-4 text-[14px]", segmentClass(mode === t.key))}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div role="radiogroup" aria-label="Background" className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
        {BACKGROUNDS.map((b) => (
          <Swatch key={b.key} label={b.label} on={active === b.key} onClick={() => pick(b.key)} style={b.light ? ({ "--sw-light": b.light, "--sw-dark": b.dark } as React.CSSProperties) : undefined} />
        ))}
        {photoUrl && (
          <Swatch
            label="Your photo"
            on={active === "photo"}
            onClick={() => pick("photo")}
            style={{ "--sw-light": `url("${photoUrl}") center / cover`, "--sw-dark": `url("${photoUrl}") center / cover` } as React.CSSProperties}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} className={buttonClass("filled")} onClick={() => input.current?.click()}>
          <ImagePlus size={15} /> {photoUrl ? "Upload a new photo" : "Upload a photo"}
        </button>
        <button type="button" disabled={pending} className={buttonClass("gray")} onClick={pickWallpaper}>
          <Monitor size={15} /> Use my wallpaper
        </button>
        {photoUrl && (
          <button type="button" disabled={pending} className={buttonClass("destructive")} onClick={() => start(() => removeBackgroundPhoto())}>
            <Trash2 size={15} /> Remove photo
          </button>
        )}
        {pending && <span className="text-[13px] text-label-2">Saving…</span>}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0] ?? undefined)} />
      </div>
      {error && <p className="text-[13px] text-red">{error}</p>}
    </div>
  );
}

function Swatch({ label, on, onClick, style }: { label: string; on: boolean; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className="group flex cursor-pointer flex-col gap-1.5 text-left">
      <span
        className={clsx(
          "swatch relative block aspect-[4/3] w-full overflow-hidden rounded-[16px] border border-[var(--glass-border)] transition group-hover:-translate-y-0.5",
          on && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]",
        )}
        style={style}
      >
        {/* A little glass card on each swatch, to preview the look. */}
        <span className="glass absolute inset-x-3 bottom-3 h-5 rounded-[8px]" />
        {on && (
          <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-ink text-on-ink">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={clsx("px-1 text-[13px]", on ? "font-semibold" : "text-label-2")}>{label}</span>
    </button>
  );
}
