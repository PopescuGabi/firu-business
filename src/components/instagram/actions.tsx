"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Unplug } from "lucide-react";
import { disconnectInstagram } from "@/app/actions/instagram";
import { buttonClass } from "../ui";

/** Refresh now (max once per 15 min) and Disconnect (deletes the stored data). */
export function IgAccountActions({ accountId, username }: { accountId: number; username: string }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      {note && <span className="text-[12px] text-label-2">{note}</span>}
      <button
        type="button"
        disabled={busy}
        className={buttonClass("gray", "sm")}
        onClick={() =>
          start(async () => {
            setNote(null);
            const res = await fetch("/api/instagram/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
            const data = await res.json().catch(() => ({}));
            setNote(res.ok ? "Updated." : (data.error ?? "Couldn't update."));
            router.refresh();
          })
        }
      >
        <RefreshCw size={13} className={busy ? "animate-spin" : undefined} /> {busy ? "Updating…" : "Refresh"}
      </button>
      <button
        type="button"
        disabled={busy}
        className={buttonClass("plain", "sm")}
        onClick={() => {
          if (!confirm(`Disconnect @${username}? Its stored posts and numbers are deleted from FIRU Business.`)) return;
          start(async () => {
            await disconnectInstagram(accountId);
            router.refresh();
          });
        }}
      >
        <Unplug size={13} /> Disconnect
      </button>
    </>
  );
}
