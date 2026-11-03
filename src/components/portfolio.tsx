"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Copy, Globe, Lock, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import {
  attachPortfolioFile,
  createPortfolioItem,
  deletePortfolioItem,
  resetShareLink,
  setPortfolioPublic,
  setShareEnabled,
} from "@/app/actions/portfolio";
import { PORTFOLIO_TYPES } from "@/lib/portfolio-types";
import { uploadToDrive } from "./drive-files";
import { buttonClass, Field } from "./ui";

type Client = { id: number; name: string };
export type PortfolioValues = {
  title: string;
  clientId: number | null;
  date: string | null;
  type: string;
  tags: string[];
  description: string;
};

/** Title, client, date, type, tags and description (shared by the new and edit forms). */
export function PortfolioFields({ clients, item }: { clients: Client[]; item?: PortfolioValues }) {
  return (
    <>
      <Field label="Title">
        <input name="title" required maxLength={200} defaultValue={item?.title} className="field" autoFocus={!item} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <select name="type" defaultValue={item?.type ?? "reel"} className="field">
            {PORTFOLIO_TYPES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client">
          <select name="clientId" defaultValue={item?.clientId ?? ""} className="field">
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" name="date" defaultValue={item?.date ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Tags" hint="Separate with commas, e.g. motion, 3D, branding.">
        <input name="tags" maxLength={500} defaultValue={item?.tags.join(", ")} className="field" />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={4} maxLength={5000} defaultValue={item?.description} className="field" placeholder="What it is, your role, the result…" />
      </Field>
    </>
  );
}

/** Drop or pick files from your laptop; they upload straight to Drive (Personal Hub/Portfolio). */
function DropZone({ files, onFiles, disabled }: { files: File[]; onFiles: (f: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add files"
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles([...e.dataTransfer.files]);
      }}
      className={clsx(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition",
        over ? "border-accent bg-accent-soft" : "border-separator hover:bg-fill",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <UploadCloud size={26} className="text-accent" />
      <p className="text-[14px] font-semibold">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} ready` : "Drop files here or click to choose"}</p>
      <p className="text-[12px] text-label-2">{files.length ? files.map((f) => f.name).join(", ") : "Videos, images, PDFs… any size, straight to your Drive"}</p>
      <input ref={input} type="file" multiple hidden onChange={(e) => onFiles([...(e.target.files ?? [])])} />
    </div>
  );
}

/** Uploads files one by one into Drive and links each to the item. */
async function uploadAll(id: number, files: File[], onStatus: (s: string) => void) {
  for (const [i, f] of files.entries()) {
    const label = files.length > 1 ? `${i + 1}/${files.length} · ` : "";
    const up = await uploadToDrive(f, { portfolio: true, onProgress: (p) => onStatus(`Uploading ${label}${f.name} · ${p}%`) });
    onStatus(`Saving ${label}${f.name}…`);
    await attachPortfolioFile(id, up.id);
  }
}

export function NewPortfolioItem({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null;
  return (
    <form
      data-keep-open
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setStatus("Saving…");
        try {
          const id = await createPortfolioItem(new FormData(e.currentTarget));
          await uploadAll(id, files, setStatus);
          router.push(`/portfolio/${id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setStatus(null);
        }
      }}
    >
      <PortfolioFields clients={clients} />
      <DropZone files={files} onFiles={(f) => setFiles((old) => [...old, ...f])} disabled={busy} />
      {error && <p role="alert" className="px-1 text-[13px] text-red">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {status && <span className="truncate text-[13px] text-label-2">{status}</span>}
        <button className={buttonClass("filled")} disabled={busy}>
          {busy ? "Working…" : files.length ? "Add and upload" : "Add to portfolio"}
        </button>
      </div>
    </form>
  );
}

export function PortfolioUploader({ id }: { id: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <DropZone
        files={[]}
        disabled={status !== null}
        onFiles={async (list) => {
          if (!list.length) return;
          setError(null);
          try {
            await uploadAll(id, list, setStatus);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setStatus(null);
          }
        }}
      />
      {status && <p className="px-1 text-[13px] text-label-2">{status}</p>}
      {error && <p role="alert" className="px-1 text-[13px] text-red">{error}</p>}
    </div>
  );
}

/** Public / private switch for one item. */
export function PublicToggle({ id, isPublic }: { id: number; isPublic: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setPortfolioPublic(id, !isPublic))}
      className={buttonClass(isPublic ? "tinted" : "gray")}
    >
      {isPublic ? <Globe size={15} /> : <Lock size={15} />}
      {pending ? "Updating…" : isPublic ? "Public" : "Private"}
    </button>
  );
}

/** Turn the public page on or off, copy its link, or make a new link. */
export function ShareControls({ url, enabled, count }: { url: string; enabled: boolean; count: number }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => start(() => setShareEnabled(e.target.checked))}
          className="size-5 accent-[var(--accent)]"
        />
        <span>
          <span className="font-semibold">Public portfolio page</span>
          <span className="block text-[13px] text-label-2">
            Shows only items marked Public ({count} now). Everything else stays private behind your login.
          </span>
        </span>
      </label>
      {enabled && (
        <>
          <div className="flex gap-2">
            <input readOnly value={url} className="field font-mono text-[13px]" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className={buttonClass("filled")}
              onClick={() =>
                navigator.clipboard.writeText(url).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  },
                  () => {},
                )
              }
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <a href={url} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-accent">
              Open the page ↗
            </a>
            <button
              type="button"
              disabled={pending}
              className={buttonClass("gray", "sm")}
              onClick={() => confirm("Make a new link? The old one stops working.") && start(() => resetShareLink())}
            >
              <RefreshCw size={13} /> New link
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Deletes the item after asking (its files stay in your Drive). */
export function DeleteItemButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass("destructive")}
      onClick={() => confirm("Delete this portfolio item? Its files stay in your Drive.") && start(() => deletePortfolioItem(id))}
    >
      <Trash2 size={15} /> {pending ? "Deleting…" : "Delete item"}
    </button>
  );
}
