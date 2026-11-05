import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { BookText, FileUp, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { createPrompt, deletePrompt, importPromptFiles, updatePrompt } from "@/app/actions/prompts";
import { getDb, schema } from "@/lib/db";
import { Sheet } from "./sheet";
import { DeleteFooter, Submit } from "./submit";
import { buttonClass, Card, Field, Section } from "./ui";

const CATEGORIES = [
  { key: "reel", label: "Reels" },
  { key: "carousel", label: "Carousels" },
  { key: "general", label: "General (used everywhere)" },
];

function PromptForm({ action, prompt, submitLabel }: { action: (fd: FormData) => Promise<void>; prompt?: { name: string; category: string; body: string }; submitLabel: string }) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_160px] gap-3">
        <Field label="Name">
          <input name="name" required maxLength={200} defaultValue={prompt?.name} className="field" placeholder="e.g. Reel editing style" />
        </Field>
        <Field label="Used for">
          <select name="category" defaultValue={prompt?.category ?? "reel"} className="field">
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label.split(" ")[0]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Prompt" hint="Paste it exactly as you would give it to Claude.">
        <textarea name="body" required rows={14} defaultValue={prompt?.body} className="field font-mono text-[13px]" />
      </Field>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}

function UploadForm() {
  return (
    <form action={importPromptFiles} className="flex flex-col gap-4">
      <p className="text-[13px] text-label-2">Upload .txt or .md files; each file becomes a prompt named after the file.</p>
      <input
        type="file"
        name="files"
        multiple
        required
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        aria-label="Prompt files"
        className="block w-full text-[13px] text-label-2 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-accent"
      />
      <Field label="Used for">
        <select name="category" defaultValue="reel" className="field">
          <option value="reel">Reels</option>
          <option value="carousel">Carousels</option>
          <option value="general">General</option>
        </select>
      </Field>
      <Submit className="self-end">Upload</Submit>
    </form>
  );
}

/**
 * Clients → Brain, the middle layer: your own saved instructions (your style). They override the
 * researched rules below; each client's Profile overrides both.
 */
export async function PromptsPanel({ uid, clients }: { uid: number; clients: { id: number; name: string; color: string }[] }) {
  const db = await getDb();
  const prompts = await db.select().from(schema.prompts).where(eq(schema.prompts.userId, uid)).orderBy(asc(schema.prompts.name));
  return (
    <div id="style" className="mb-10 scroll-mt-6">
      <Card className="mb-6 p-4 text-[14px] leading-relaxed text-label-2">
        What Opus follows, in three layers: the <strong className="text-label">researched rules</strong> below, then <strong className="text-label">your style</strong> (your saved prompts), then each{" "}
        <strong className="text-label">client&apos;s profile</strong>. A later layer wins when they disagree, and the brief for a single reel or carousel wins over all of them.
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-[22px] font-bold">Your style</h2>
        <Sheet title="Upload prompt files" trigger={<><FileUp size={15} /> Upload files</>} triggerClassName={buttonClass("gray")}>
          <UploadForm />
        </Sheet>
        <Sheet title="New prompt" trigger={<><Plus size={16} /> New prompt</>} triggerClassName={buttonClass("filled")}>
          <PromptForm action={createPrompt} submitLabel="Save prompt" />
        </Sheet>
      </div>

      {prompts.length === 0 ? (
        <Card className="flex items-start gap-3 p-4 text-[14px] text-label-2">
          <BookText size={20} className="mt-0.5 shrink-0 text-label-3" />
          <p>Paste the instructions you usually give Claude. The reel and carousel editors use them automatically, and you can switch each one on or off per chat.</p>
        </Card>
      ) : (
        CATEGORIES.map((cat) => {
          const list = prompts.filter((p) => p.category === cat.key);
          if (!list.length) return null;
          return (
            <Section key={cat.key} title={cat.label}>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((p) => (
                  <Card key={p.id} className="flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[17px] font-semibold">{p.name}</h3>
                      <Sheet title="Edit prompt" trigger={<Pencil size={15} />} triggerLabel={`Edit ${p.name}`} triggerClassName="cursor-pointer rounded-full p-1.5 text-label-2 hover:bg-fill">
                        <PromptForm action={updatePrompt.bind(null, p.id)} prompt={p} submitLabel="Save" />
                        <DeleteFooter action={deletePrompt.bind(null, p.id)} message={`Delete “${p.name}”?`}>
                          <Trash2 size={15} /> Delete prompt
                        </DeleteFooter>
                      </Sheet>
                    </div>
                    <p className="mt-2 line-clamp-5 font-mono text-[12px] whitespace-pre-wrap text-label-2">{p.body}</p>
                    <p className="mt-auto pt-3 text-[12px] text-label-3">{p.body.length.toLocaleString()} characters</p>
                  </Card>
                ))}
              </div>
            </Section>
          );
        })
      )}

      {clients.length > 0 && (
        <Section className="mt-8" title="Client profiles" footer="Audience, voice, brand and what has worked for each client; they override your style for that client.">
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}?tab=profile`} className={buttonClass("gray", "sm")}>
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                <UserRound size={13} /> {c.name}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
