"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { requestSync } from "@/lib/calendar-sync";

const taskInput = z.object({
  title: z.string().trim().min(1).max(300),
  notes: z.string().max(5000).default(""),
  clientId: z.coerce.number().int().positive().nullable().catch(null),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  estimateMin: z.coerce.number().int().min(5).max(24 * 60).catch(30),
  priority: z.coerce.number().int().min(0).max(2).catch(1),
});

function fromForm(fd: FormData) {
  return taskInput.parse({
    title: fd.get("title"),
    notes: fd.get("notes") ?? "",
    clientId: fd.get("clientId") || null,
    due: fd.get("due") || null,
    estimateMin: fd.get("estimateMin"),
    priority: fd.get("priority"),
  });
}

export async function createTask(fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.insert(schema.tasks).values(fromForm(fd));
  revalidatePath("/", "layout");
  requestSync();
}

export async function updateTask(id: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.tasks).set(fromForm(fd)).where(eq(schema.tasks.id, id));
  revalidatePath("/", "layout");
  requestSync();
}

export async function toggleTask(id: number, done: boolean) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.tasks).set({ done }).where(eq(schema.tasks.id, id));
  revalidatePath("/", "layout");
  requestSync();
}

export async function deleteTask(id: number) {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  revalidatePath("/", "layout");
  requestSync();
}

/** Accepting a block puts it in the Personal Hub calendar (when calendar sync is on). */
export async function acceptBlock(id: number) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.planBlocks).set({ status: "accepted" }).where(eq(schema.planBlocks.id, id));
  revalidatePath("/", "layout");
  requestSync();
  return { ok: true, warning: null as string | null };
}

export async function removeBlock(id: number) {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.planBlocks).where(eq(schema.planBlocks.id, id));
  revalidatePath("/", "layout");
  requestSync();
}

/** Deletes every suggestion you haven't accepted. Accepted blocks stay. */
export async function clearSuggestions() {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.planBlocks).where(eq(schema.planBlocks.status, "proposed"));
  revalidatePath("/", "layout");
  requestSync();
}

export async function acceptBlockForm(id: number) {
  await acceptBlock(id);
}
