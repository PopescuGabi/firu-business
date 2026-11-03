"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

/** target is "" (general), or "reel:12" / "carousel:3" / "appUpdate:5". */
export async function addFeedback(fd: FormData) {
  const user = await requireUser();
  const note = z.string().trim().min(1).max(5000).parse(fd.get("note"));
  const m = String(fd.get("target") ?? "").match(/^(reel|carousel|appUpdate):(\d+)$/);
  const db = await getDb();
  let clientId: number;
  if (m) {
    // The client always comes from the item itself.
    const table = m[1] === "reel" ? schema.reels : m[1] === "carousel" ? schema.carousels : schema.appUpdates;
    const [row] = await db.select({ clientId: table.clientId }).from(table).where(and(eq(table.id, Number(m[2])), eq(table.userId, user.id)));
    if (!row) throw new Error("Item not found");
    clientId = row.clientId;
  } else {
    clientId = z.coerce.number().int().positive().parse(fd.get("clientId"));
    const [client] = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, user.id)));
    if (!client) throw new Error("Client not found");
  }
  await db.insert(schema.clientFeedback).values({
    userId: user.id,
    clientId,
    note,
    targetType: m ? m[1] : null,
    targetId: m ? Number(m[2]) : null,
  });
  revalidatePath("/", "layout");
}

export async function setFeedbackDone(id: number, done: boolean) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(schema.clientFeedback)
    .set({ status: done ? "done" : "open", doneAt: done ? new Date() : null })
    .where(and(eq(schema.clientFeedback.id, id), eq(schema.clientFeedback.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function deleteFeedback(id: number) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.clientFeedback).where(and(eq(schema.clientFeedback.id, id), eq(schema.clientFeedback.userId, user.id)));
  revalidatePath("/", "layout");
}
