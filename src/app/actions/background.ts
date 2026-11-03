"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isBackground } from "@/lib/backgrounds";
import { getDb, schema } from "@/lib/db";
import { getSettings, saveSettings } from "@/lib/settings";

const TYPES = ["image/jpeg", "image/webp", "image/png"];
const MAX_BYTES = 3 * 1024 * 1024; // the browser shrinks photos to well under this

export async function chooseBackground(key: string) {
  const user = await requireUser();
  if (!isBackground(key)) throw new Error("Unknown background");
  await saveSettings(user.id, { background: key });
  revalidatePath("/", "layout");
}

/** Saves (or replaces) this person's background photo and switches to it. */
export async function uploadBackground(fd: FormData) {
  const user = await requireUser();
  const file = fd.get("photo");
  if (!(file instanceof File) || !TYPES.includes(file.type)) throw new Error("Pick a JPEG, PNG or WebP photo");
  if (file.size > MAX_BYTES) throw new Error("That photo is too big");
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const db = await getDb();
  await db
    .insert(schema.backgrounds)
    .values({ userId: user.id, mime: file.type, data })
    .onConflictDoUpdate({ target: schema.backgrounds.userId, set: { mime: file.type, data, updatedAt: new Date() } });
  await saveSettings(user.id, { background: "photo" });
  revalidatePath("/", "layout");
}

export async function removeBackgroundPhoto() {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(schema.backgrounds).where(eq(schema.backgrounds.userId, user.id));
  if ((await getSettings(user.id)).background === "photo") await saveSettings(user.id, { background: "default" });
  revalidatePath("/", "layout");
}
