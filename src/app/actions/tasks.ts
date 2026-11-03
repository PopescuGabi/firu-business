"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema, type Db } from "@/lib/db";
import { mutateSchedule } from "@/lib/mutate";

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

/** A task's client must be one of yours (or none). */
async function checkClient(db: Db, uid: number, clientId: number | null) {
  if (clientId === null) return;
  const [c] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
}

export async function createTask(fd: FormData) {
  await mutateSchedule(async (db, uid) => {
    const values = fromForm(fd);
    await checkClient(db, uid, values.clientId);
    return db.insert(schema.tasks).values({ userId: uid, ...values });
  });
}

export async function updateTask(id: number, fd: FormData) {
  await mutateSchedule(async (db, uid) => {
    const values = fromForm(fd);
    await checkClient(db, uid, values.clientId);
    return db.update(schema.tasks).set(values).where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, uid)));
  });
}

export async function toggleTask(id: number, done: boolean) {
  await mutateSchedule((db, uid) =>
    db.update(schema.tasks).set({ done }).where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, uid))),
  );
}

export async function deleteTask(id: number) {
  await mutateSchedule((db, uid) => db.delete(schema.tasks).where(and(eq(schema.tasks.id, id), eq(schema.tasks.userId, uid))));
}

/** Accepting a block puts it in the Personal Hub calendar (when calendar sync is on). */
export async function acceptBlock(id: number) {
  await mutateSchedule((db, uid) =>
    db
      .update(schema.planBlocks)
      .set({ status: "accepted" })
      .where(and(eq(schema.planBlocks.id, id), eq(schema.planBlocks.userId, uid))),
  );
}

export async function removeBlock(id: number) {
  await mutateSchedule((db, uid) =>
    db.delete(schema.planBlocks).where(and(eq(schema.planBlocks.id, id), eq(schema.planBlocks.userId, uid))),
  );
}

/** Deletes every suggestion you haven't accepted. Accepted blocks stay. */
export async function clearSuggestions() {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.planBlocks).where(and(eq(schema.planBlocks.userId, user.id), eq(schema.planBlocks.status, "proposed")));
  revalidatePath("/", "layout");
}
