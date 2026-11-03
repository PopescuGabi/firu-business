"use client";
import { useRef, useState } from "react";
import { ExternalLink, FileText, Film, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { attachFile, detachFile } from "@/app/actions/clients";
import type { DriveFile } from "@/lib/db/schema";
import { buttonClass } from "./ui";

type Target = "appUpdate" | "reel" | "carousel";
type Section = "App" | "Reels" | "Carousels";

/** Uploads straight from the browser to Google Drive (resumable), then links the file here. */
export async function uploadToDrive(
  file: Blob & { name?: string },
  opts: ({ clientId: number; section: Section } | { portfolio: true }) & { name?: string; onProgress?: (pct: number) => void },
) {
  const name = opts.name ?? file.name ?? "file";
  const where = "portfolio" in opts ? { portfolio: true } : { clientId: opts.clientId, section: opts.section };
  const res = await fetch("/api/drive/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...where, name, mimeType: file.type, size: file.size }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not start upload");
  return new Promise<{ id: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`Drive upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

function iconFor(mime: string) {
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("image/")) return ImageIcon;
  return FileText;
}

export function DriveFiles({
  clientId,
  section,
  target,
  targetId,
  files: initial,
  googleConnected,
}: {
  clientId: number;
  section: Section;
  target: Target;
  targetId: number;
  files: DriveFile[];
  googleConnected: boolean;
}) {
  const [files, setFiles] = useState(initial);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    try {
      for (const [i, f] of Array.from(list).entries()) {
        const label = list.length > 1 ? `${i + 1}/${list.length} ` : "";
        setProgress(`${label}0%`);
        const uploaded = await uploadToDrive(f, { clientId, section, onProgress: (p) => setProgress(`${label}${p}%`) });
        setFiles(await attachFile(target, targetId, uploaded.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      {files.length > 0 && (
        <ul className="mb-2 divide-y divide-separator rounded-xl bg-fill/60">
          {files.map((f) => {
            const Icon = iconFor(f.mimeType);
            return (
              <li key={f.id} className="flex items-center gap-2.5 px-3 py-2 text-[14px]">
                <Icon size={16} className="shrink-0 text-label-2" />
                <a href={f.webViewLink} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-blue">
                  {f.name}
                </a>
                <a href={f.webViewLink} target="_blank" rel="noreferrer" aria-label={`Open ${f.name} in Drive`} className="text-label-2 hover:text-blue">
                  <ExternalLink size={14} />
                </a>
                <button
                  aria-label={`Unlink ${f.name}`}
                  title="Unlink (the file stays in your Drive)"
                  className="cursor-pointer rounded-full p-1 text-label-2 hover:bg-fill-2"
                  onClick={async () => setFiles(await detachFile(target, targetId, f.id))}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {googleConnected ? (
        <>
          <input ref={input} type="file" multiple hidden onChange={(e) => onPick(e.target.files)} />
          <button type="button" className={buttonClass("tinted", "sm")} disabled={!!progress} onClick={() => input.current?.click()}>
            <Paperclip size={14} />
            {progress ? `Uploading ${progress}` : "Upload to Drive"}
          </button>
        </>
      ) : (
        <p className="text-[13px] text-label-2">Connect Google in Settings to upload files to Drive.</p>
      )}
      {error && <p role="alert" className="mt-1 text-[13px] text-red">{error}</p>}
    </div>
  );
}
