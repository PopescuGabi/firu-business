"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

const input = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(["reel", "carousel", "general"]).catch("reel"),
  body: z.string().trim().min(1).max(100_000),
});
const fromForm = (fd: FormData) =>
  input.parse({ name: fd.get("name"), category: fd.get("category"), body: fd.get("body") });

export async function createPrompt(fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.insert(schema.prompts).values(fromForm(fd));
  revalidatePath("/prompts");
}

export async function updatePrompt(id: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.prompts).set({ ...fromForm(fd), updatedAt: new Date() }).where(eq(schema.prompts.id, id));
  revalidatePath("/prompts");
}

export async function deletePrompt(id: number) {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.prompts).where(eq(schema.prompts.id, id));
  revalidatePath("/prompts");
}

/** Uploads .txt / .md files as prompts: the file name becomes the prompt name. */
export async function importPromptFiles(fd: FormData) {
  await requireUser();
  const category = z.enum(["reel", "carousel", "general"]).catch("reel").parse(fd.get("category"));
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 20);
  const rows = [];
  for (const f of files) {
    if (f.size > 200_000 || !/\.(txt|md|markdown)$/i.test(f.name)) continue;
    const body = (await f.text()).trim();
    if (!body) continue;
    rows.push({ name: f.name.replace(/\.(txt|md|markdown)$/i, "").slice(0, 200), category, body });
  }
  if (rows.length) {
    const db = await getDb();
    await db.insert(schema.prompts).values(rows);
  }
  revalidatePath("/", "layout");
}
