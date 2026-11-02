import { asc } from "drizzle-orm";
import { BookText, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { ConfirmButton, Submit } from "@/components/submit";
import { buttonClass, Card, Empty, Field, PageHeader, Section } from "@/components/ui";
import { createPrompt, deletePrompt, updatePrompt } from "@/app/actions/prompts";
import { getDb, schema } from "@/lib/db";

export const metadata = { title: "Prompts" };

const CATEGORIES = [
  { key: "reel", label: "Reels" },
  { key: "carousel", label: "Carousels" },
  { key: "general", label: "General (used everywhere)" },
];

function PromptForm({
  action,
  prompt,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  prompt?: { name: string; category: string; body: string };
  submitLabel: string;
}) {
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
      <Field label="Prompt" hint="Paste it exactly as you gave it to Claude on your PC.">
        <textarea name="body" required rows={14} defaultValue={prompt?.body} className="field font-mono text-[13px]" />
      </Field>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}

export default async function PromptsPage() {
  const db = await getDb();
  const prompts = await db.select().from(schema.prompts).orderBy(asc(schema.prompts.name));
  return (
    <>
      <PageHeader
        title="Prompts"
        subtitle="Your instructions for Opus 5.5"
        actions={
          <Sheet title="New prompt" trigger={<><Plus size={16} /> New prompt</>} triggerClassName={buttonClass("filled")}>
            <PromptForm action={createPrompt} submitLabel="Save prompt" />
          </Sheet>
        }
      />
      {prompts.length === 0 ? (
        <Empty icon={<BookText size={36} />} title="Add the prompts from your PC">
          Paste each prompt you gave Claude on your Windows PC. The reel and carousel editors use them automatically, and you can switch each one on or off per chat.
        </Empty>
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
                        <form action={deletePrompt.bind(null, p.id)} className="mt-3 border-t border-separator pt-3">
                          <ConfirmButton message={`Delete “${p.name}”?`}>
                            <Trash2 size={15} /> Delete prompt
                          </ConfirmButton>
                        </form>
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
    </>
  );
}
