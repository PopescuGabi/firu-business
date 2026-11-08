"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Archive, ArchiveRestore, Ellipsis, FolderOpen, Pencil, Share2 } from "lucide-react";
import { createClientFolder } from "@/app/actions/clients";
import { buttonClass } from "./ui";

/**
 * The ⋯ button on a client page: the things you need now and then (Drive folder, edit, their dashboard, archive),
 * kept out of the way so the header stays calm.
 */
export function ClientMoreMenu({
  clientId,
  clientName,
  driveUrl,
  googleConnected,
  archived,
  editSheetId,
  dashboardHref,
  setArchived,
}: {
  clientId: number;
  clientName: string;
  driveUrl: string | null;
  googleConnected: boolean;
  archived: boolean;
  editSheetId: string;
  dashboardHref?: string;
  setArchived: (archived: boolean) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[14px] hover:bg-fill";
  return (
    <div ref={box} className="relative">
      <button type="button" aria-label="More" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} className={clsx(buttonClass("gray"), "!w-9 !px-0")}>
        <Ellipsis size={17} />
      </button>
      {open && (
        <div role="menu" className="ctx-menu absolute top-11 right-0 z-40 w-56 rounded-[16px] p-1.5">
          {driveUrl ? (
            <a role="menuitem" href={driveUrl} target="_blank" rel="noreferrer" className={item} onClick={() => setOpen(false)}>
              <FolderOpen size={16} className="text-label-2" /> Open Drive folder
            </a>
          ) : (
            googleConnected && (
              <button
                role="menuitem"
                type="button"
                className={item}
                onClick={async () => {
                  setNote("Creating the folder…");
                  try {
                    window.open(await createClientFolder(clientId), "_blank", "noopener");
                    setNote(null);
                    setOpen(false);
                  } catch (e) {
                    setNote(e instanceof Error ? e.message : "Couldn't create the folder.");
                  }
                }}
              >
                <FolderOpen size={16} className="text-label-2" /> Create Drive folder
              </button>
            )
          )}
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("open-sheet", { detail: editSheetId }));
            }}
          >
            <Pencil size={16} className="text-label-2" /> Edit client
          </button>
          {dashboardHref && (
            <Link role="menuitem" href={dashboardHref} className={item} onClick={() => setOpen(false)}>
              <Share2 size={16} className="text-label-2" /> Their dashboard
            </Link>
          )}
          <div className="my-1 border-t border-separator" />
          <button
            role="menuitem"
            type="button"
            className={clsx(item, !archived && "text-red")}
            onClick={async () => {
              if (!archived && !confirm(`Archive ${clientName}? You can restore it from the Clients page.`)) return;
              setOpen(false);
              await setArchived(!archived);
            }}
          >
            {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />} {archived ? "Restore client" : "Archive client"}
          </button>
          {note && <p className="px-2.5 pt-1 pb-1.5 text-[12px] text-label-2">{note}</p>}
        </div>
      )}
    </div>
  );
}
