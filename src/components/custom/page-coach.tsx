"use client";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { parsePageDraft, type Spec } from "@/lib/custom-pages";
import { ClaudePanel, type ChatMessage } from "../claude-panel";
import { Sheet } from "../sheet";
import { buttonClass } from "../ui";

const SUGGESTIONS = ["Add a field for the price", "Show these as a board by status", "Add a chart of this per month", "Add a checklist for recurring tasks"];

/** "Edit with AI": Sonnet proposes a new layout for this page; Apply keeps every entry. */
export function PageCoach({ pageId, spec, messages, claudeConfigured }: { pageId: number; spec: Spec; messages: ChatMessage[]; claudeConfigured: boolean }) {
  const router = useRouter();
  if (!claudeConfigured) return null;
  return (
    <Sheet title="Edit this page with AI" trigger={<><Wand2 size={14} /> Edit with AI</>} triggerClassName={buttonClass("tinted", "sm")}>
      <div className="h-[min(640px,70dvh)]">
        <ClaudePanel<null>
          targetType="page"
          targetId={pageId}
          endpoint="/api/ai/page"
          modelLabel="Sonnet 5.5 · page editor"
          emptyTitle="What should change?"
          initialMessages={messages}
          prompts={[]}
          claudeConfigured
          suggestions={SUGGESTIONS}
          onApplied={() => router.refresh()}
          renderProposal={(raw) => {
            const { draft } = parsePageDraft(raw);
            if (!draft) return <p className="text-label-2">This layout can&apos;t be shown.</p>;
            const before = new Set(spec.collections.flatMap((c) => c.fields.map((f) => `${c.key}.${f.key}`)));
            const blocksBefore = new Set(spec.blocks.map((b) => b.id));
            return (
              <>
                {(raw as { summary?: string }).summary && <p>{(raw as { summary?: string }).summary}</p>}
                {draft.spec.collections.map((c) => (
                  <div key={c.key} className="rounded-[14px] bg-well px-3 py-2">
                    <p className="text-[12px] font-semibold uppercase">{c.name}</p>
                    <p className="text-label-2">
                      {c.fields.map((f, i) => (
                        <span key={f.key} className={before.has(`${c.key}.${f.key}`) ? undefined : "font-semibold text-green"}>
                          {i ? ", " : ""}
                          {f.label}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
                <p className="text-label-2">
                  Blocks:{" "}
                  {draft.spec.blocks.map((b, i) => (
                    <span key={b.id} className={blocksBefore.has(b.id) ? undefined : "font-semibold text-green"}>
                      {i ? " · " : ""}
                      {b.title}
                    </span>
                  ))}
                </p>
              </>
            );
          }}
        />
      </div>
    </Sheet>
  );
}
