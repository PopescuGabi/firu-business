"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronLeft, Sparkles, Trash2 } from "lucide-react";
import { deleteReel, saveReel } from "@/app/actions/clients";
import type { DriveFile } from "@/lib/db/schema";
import { ClaudePanel, type ChatMessage } from "./claude-panel";
import { DriveFiles } from "./drive-files";
import { buttonClass, Card, Field, STATUS_COLORS, statusLabel } from "./ui";
import { SaveIndicator, useAutosave } from "./use-autosave";

type Reel = {
  id: number;
  clientId: number;
  title: string;
  status: string;
  hook: string;
  script: string;
  caption: string;
  notes: string;
  postDate: string | null;
  files: DriveFile[];
};
type Fields = Pick<Reel, "title" | "status" | "hook" | "script" | "caption" | "notes" | "postDate">;

const STATUSES = ["idea", "scripting", "filming", "editing", "review", "posted"] as const;
const LABELS: Record<string, string> = { title: "Title", hook: "Hook", script: "Script", caption: "Caption", notes: "Editing notes" };

const pick = (r: Reel): Fields => ({
  title: r.title,
  status: r.status,
  hook: r.hook,
  script: r.script,
  caption: r.caption,
  notes: r.notes,
  postDate: r.postDate,
});

export function ReelEditor({
  reel,
  clientName,
  messages,
  prompts,
  claudeConfigured,
  googleConnected,
  brain,
}: {
  brain?: ReactNode;
  reel: Reel;
  clientName: string;
  messages: ChatMessage[];
  prompts: { id: number; name: string; category: string }[];
  claudeConfigured: boolean;
  googleConnected: boolean;
}) {
  const [fields, setFields] = useState<Fields>(pick(reel));
  const { state, reset } = useAutosave(fields, (f) =>
    saveReel(reel.id, { ...f, status: f.status as (typeof STATUSES)[number], title: f.title.trim() || "Untitled reel" }),
  );
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/clients/${reel.clientId}?tab=reels`} className="flex items-center text-[15px] text-blue">
          <ChevronLeft size={20} /> {clientName} reels
        </Link>
        <div className="flex items-center gap-3">
          <SaveIndicator state={state} />
          <a href="#opus" className={buttonClass("tinted", "sm") + " lg:hidden"}>
            <Sparkles size={14} /> Ask Opus
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          <input
            value={fields.title}
            onChange={(e) => set("title", e.target.value)}
            aria-label="Reel title"
            className="w-full bg-transparent text-[28px] font-bold tracking-tight outline-none placeholder:text-label-3"
            placeholder="Reel title"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1 rounded-[20px] bg-fill p-1">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  role="radio"
                  aria-checked={fields.status === s}
                  onClick={() => set("status", s)}
                  className="h-7 cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors duration-200"
                  style={fields.status === s ? { background: `color-mix(in srgb, ${STATUS_COLORS[s]} 18%, var(--card-solid))`, color: STATUS_COLORS[s], fontWeight: 600 } : { color: "var(--label-2)" }}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-label-2">
              Post date
              <input type="date" value={fields.postDate ?? ""} onChange={(e) => set("postDate", e.target.value || null)} className="field !w-auto !py-1" />
            </label>
          </div>

          <Card className="space-y-4 p-4">
            <Field label="Hook (first 1–3 seconds)">
              <textarea value={fields.hook} onChange={(e) => set("hook", e.target.value)} rows={2} className="field" />
            </Field>
            <Field label="Script">
              <textarea value={fields.script} onChange={(e) => set("script", e.target.value)} rows={10} className="field" />
            </Field>
            <Field label="Caption">
              <textarea value={fields.caption} onChange={(e) => set("caption", e.target.value)} rows={4} className="field" />
            </Field>
            <Field label="Editing notes" hint="Cuts, B-roll, captions, music, transitions.">
              <textarea value={fields.notes} onChange={(e) => set("notes", e.target.value)} rows={5} className="field" />
            </Field>
          </Card>

          {brain}

          <Card className="p-4">
            <p className="mb-2 text-[13px] font-medium text-label-2">Footage & exports (Google Drive)</p>
            <DriveFiles clientId={reel.clientId} section="Reels" target="reel" targetId={reel.id} files={reel.files} googleConnected={googleConnected} />
          </Card>

          <form action={deleteReel.bind(null, reel.id)}>
            <button
              className={buttonClass("destructive", "sm")}
              onClick={(e) => {
                if (!confirm("Delete this reel? Drive files stay in Drive.")) e.preventDefault();
              }}
            >
              <Trash2 size={14} /> Delete reel
            </button>
          </form>
        </div>

        <div id="opus" className="scroll-mt-4 lg:sticky lg:top-6 lg:h-[calc(100dvh-48px)]">
          <ClaudePanel<Reel>
            targetType="reel"
            targetId={reel.id}
            initialMessages={messages}
            prompts={prompts}
            claudeConfigured={claudeConfigured}
            suggestions={["Write 3 aligned hook options", "Tighten the script for 30 seconds", "Write editing notes with a caption plan", "Write the post caption with one CTA"]}
            onApplied={(r) => {
              const next = pick(r);
              reset(next);
              setFields(next);
            }}
            renderProposal={(p) => {
              const proposal = p as Record<string, string>;
              return Object.entries(LABELS)
                .filter(([k]) => typeof proposal[k] === "string")
                .map(([k, label]) => (
                  <div key={k}>
                    <p className="font-semibold">{label}</p>
                    <p className="line-clamp-6 whitespace-pre-wrap text-label-2">{proposal[k]}</p>
                  </div>
                ));
            }}
          />
        </div>
      </div>
    </>
  );
}
