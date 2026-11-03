"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getMail, gmailLink, sendReply } from "@/lib/google/gmail";

export type MailState = { ok: boolean; message: string; at: number } | null;

/** Sends your reply in the same Gmail thread. */
export async function replyToMail(id: string, _prev: MailState, fd: FormData): Promise<MailState> {
  const user = await requireUser();
  const text = z.string().trim().min(1, "Write a reply first").max(20_000).safeParse(fd.get("text"));
  if (!text.success) return { ok: false, message: text.error.issues[0].message, at: Date.now() };
  try {
    const mail = await getMail(user.id, id);
    await sendReply(user.id, mail, text.data);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't send", at: Date.now() };
  }
  return { ok: true, message: "Sent", at: Date.now() };
}

/** A task from an email: its subject as the title, a link back to the thread in the notes. */
export async function mailToTask(id: string, _prev: MailState, fd: FormData): Promise<MailState> {
  const user = await requireUser();
  const due = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null).parse(fd.get("due") || null);
  try {
    const mail = await getMail(user.id, id);
    const title = String(fd.get("title") || mail.subject).trim().slice(0, 200) || "Email";
    const db = await getDb();
    await db.insert(schema.tasks).values({
      userId: user.id,
      title,
      due,
      notes: `From ${mail.from} <${mail.fromEmail}>\n${gmailLink(mail)}`,
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't make the task", at: Date.now() };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Task added", at: Date.now() };
}
