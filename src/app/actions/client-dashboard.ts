"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { acceptClientInvites, shareableFor } from "@/lib/client-links";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMessage } from "@/lib/google/gmail";
import { invite } from "@/lib/users";
import type { FormState } from "./account";

async function ownClient(uid: number, clientId: number) {
  const db = await getDb();
  const [c] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, z.number().int().positive().parse(clientId)), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
  return c;
}

/**
 * Invites the client's contact to their dashboard: lets that Google account sign in, remembers which client it's for,
 * and (only when "Send from my Gmail" was pressed) emails them the message from your Gmail.
 */
export async function inviteClient(clientId: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const client = await ownClient(user.id, clientId);
  const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  if (!email.success) return { ok: false, message: "That doesn't look like an email address." };
  if (email.data === user.email) return { ok: false, message: "That's your own email." };
  const message = z.string().trim().min(1).max(5000).safeParse(fd.get("message"));
  const send = fd.get("send") === "1";
  if (send && !message.success) return { ok: false, message: "Write the message first." };

  const db = await getDb();
  await invite(email.data);
  await db
    .insert(schema.clientInvites)
    .values({ userId: user.id, clientId: client.id, email: email.data })
    .onConflictDoUpdate({ target: schema.clientInvites.clientId, set: { email: email.data, sentAt: null } });
  // Someone who already has an account is linked straight away.
  const [existing] = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(eq(schema.users.email, email.data));
  if (existing) await acceptClientInvites(existing);

  if (send) {
    try {
      await sendMessage(user.id, email.data, `${client.name}: your dashboard in Personal Hub`, message.data!);
      await db.update(schema.clientInvites).set({ sentAt: new Date() }).where(and(eq(schema.clientInvites.clientId, client.id), eq(schema.clientInvites.userId, user.id)));
    } catch (err) {
      revalidatePath(`/clients/${client.id}`);
      return { ok: false, message: `Invite saved, but the email didn't go out: ${err instanceof Error ? err.message : "Gmail error"}. Copy the message instead.` };
    }
  }
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, message: send ? `Sent to ${email.data} from your Gmail.` : `Invite saved. ${email.data} can now sign in at ${env.appUrl()}.` };
}

export async function cancelClientInvite(clientId: number) {
  const user = await requireUser();
  const client = await ownClient(user.id, clientId);
  const db = await getDb();
  await db.delete(schema.clientInvites).where(and(eq(schema.clientInvites.userId, user.id), eq(schema.clientInvites.clientId, client.id)));
  revalidatePath(`/clients/${client.id}`);
}

/** What the client sees on their dashboard (only tools the client has; never finance). */
export async function setShared(clientId: number, sections: string[]) {
  const user = await requireUser();
  const client = await ownClient(user.id, clientId);
  const allowed = shareableFor(client.features);
  const db = await getDb();
  await db
    .update(schema.clientLinks)
    .set({ shared: [...new Set(sections)].filter((s) => (allowed as string[]).includes(s)) })
    .where(and(eq(schema.clientLinks.userId, user.id), eq(schema.clientLinks.clientId, client.id)));
  revalidatePath("/", "layout");
}

/** Stops sharing: their account stays (it's their own hub), the "From you" dashboard disappears. */
export async function removeClientAccess(clientId: number) {
  const user = await requireUser();
  const client = await ownClient(user.id, clientId);
  const db = await getDb();
  await db.delete(schema.clientLinks).where(and(eq(schema.clientLinks.userId, user.id), eq(schema.clientLinks.clientId, client.id)));
  revalidatePath("/", "layout");
}
