"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { createEvent, deleteEvent } from "@/lib/google/calendar";
import { getGoogleAccount } from "@/lib/google/oauth";
import { getSettings } from "@/lib/settings";

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
}

export async function updateTask(id: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.tasks).set(fromForm(fd)).where(eq(schema.tasks.id, id));
  revalidatePath("/", "layout");
}

export async function toggleTask(id: number, done: boolean) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.tasks).set({ done }).where(eq(schema.tasks.id, id));
  revalidatePath("/", "layout");
}

export async function deleteTask(id: number) {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  revalidatePath("/", "layout");
}

/** Accepting a block puts it in Google Calendar (when connected). */
export async function acceptBlock(id: number) {
  await requireUser();
  const db = await getDb();
  const [b] = await db.select().from(schema.planBlocks).where(eq(schema.planBlocks.id, id));
  if (!b || b.status === "accepted") return { ok: true };
  const settings = await getSettings();
  let gcalEventId: string | null = null;
  let warning: string | null = null;
  if ((await getGoogleAccount())?.accessToken) {
    try {
      gcalEventId = await createEvent(settings.targetCalendarId, {
        title: b.title,
        description: b.reason ? `${b.reason}\n\nAdded from Personal Hub.` : "Added from Personal Hub.",
        start: `${b.date}T${b.start}:00`,
        end: `${b.date}T${b.end}:00`,
        timeZone: settings.timezone,
      });
    } catch (err) {
      warning = err instanceof Error ? err.message : "Could not add to Google Calendar";
    }
  }
  await db.update(schema.planBlocks).set({ status: "accepted", gcalEventId }).where(eq(schema.planBlocks.id, id));
  revalidatePath("/", "layout");
  return { ok: true, warning };
}

export async function removeBlock(id: number) {
  await requireUser();
  const db = await getDb();
  const [b] = await db.select().from(schema.planBlocks).where(eq(schema.planBlocks.id, id));
  if (!b) return;
  if (b.gcalEventId) {
    const settings = await getSettings();
    await deleteEvent(settings.targetCalendarId, b.gcalEventId).catch(() => {});
  }
  await db.delete(schema.planBlocks).where(eq(schema.planBlocks.id, id));
  revalidatePath("/", "layout");
}

/** Deletes every suggestion you haven't accepted. Accepted blocks stay. */
export async function clearSuggestions() {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.planBlocks).where(eq(schema.planBlocks.status, "proposed"));
  revalidatePath("/", "layout");
}

export async function acceptBlockForm(id: number) {
  await acceptBlock(id);
}
