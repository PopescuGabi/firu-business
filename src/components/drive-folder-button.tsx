"use client";
import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { createClientFolder } from "@/app/actions/clients";
import { buttonClass } from "./ui";

export function DriveFolderButton({ clientId, url }: { clientId: number; url: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={buttonClass("gray")}>
        <FolderOpen size={16} /> Drive folder
      </a>
    );
  }
  return (
    <span className="flex flex-col items-end">
      <button
        className={buttonClass("gray")}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            window.open(await createClientFolder(clientId), "_blank", "noopener");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <FolderOpen size={16} /> {busy ? "Creating…" : "Create Drive folder"}
      </button>
      {error && <span className="text-[12px] text-red">{error}</span>}
    </span>
  );
}
