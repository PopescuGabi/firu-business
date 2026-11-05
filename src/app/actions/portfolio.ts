"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import type { DriveFile } from "@/lib/db/schema";
import { getFileMeta, setLinkSharing } from "@/lib/google/drive";
import { getShare, newShareToken, PORTFOLIO_TYPES, saveShare } from "@/lib/portfolio";
import { cleanUrl } from "@/lib/portfolio-types";

const fields = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  clientId: z.coerce.number().int().positive().nullable().catch(null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  type: z.enum(PORTFOLIO_TYPES.map(([k]) => k) as [string, ...string[]]).catch("other"),
  tags: z.string().max(500).transform((s) => [...new Set(s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
  description: z.string().max(5000),
  link: z.string().max(500).transform(cleanUrl),
});

function parse(fd: FormData) {
  return fields.parse({
    title: fd.get("title"),
    clientId: fd.get("clientId") || null,
    date: fd.get("date") || null,
    type: fd.get("type"),
    tags: fd.get("tags") ?? "",
    description: fd.get("description") ?? "",
    link: fd.get("link") ?? "",
  });
}

async function getItem(uid: number, id: number) {
  const db = await getDb();
  const [item] = await db
    .select()
    .from(schema.portfolioItems)
    .where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, uid)));
  if (!item) throw new Error("Portfolio item not found");
  return item;
}

function refresh(id?: number) {
  revalidatePath("/portfolio");
  if (id) revalidatePath(`/portfolio/${id}`);
}

/** The item's client must be one of yours (or none). */
async function checkClient(uid: number, clientId: number | null) {
  if (clientId === null) return;
  const db = await getDb();
  const [c] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
}

/** Creates the item and returns its id; the browser then uploads the files into it. */
export async function createPortfolioItem(fd: FormData) {
  const user = await requireUser();
  const values = parse(fd);
  await checkClient(user.id, values.clientId);
  const db = await getDb();
  const [row] = await db
    .insert(schema.portfolioItems)
    .values({ userId: user.id, ...values })
    .returning({ id: schema.portfolioItems.id });
  refresh();
  return row.id;
}

export async function updatePortfolioItem(id: number, fd: FormData) {
  const user = await requireUser();
  const values = parse(fd);
  await checkClient(user.id, values.clientId);
  const db = await getDb();
  await db.update(schema.portfolioItems).set({ ...values, updatedAt: new Date() }).where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id)));
  refresh(id);
}

/** Deletes the item. Its files stay in your Drive, made private again. */
export async function deletePortfolioItem(id: number) {
  const user = await requireUser();
  const item = await getItem(user.id, id);
  if (item.public) await Promise.all(item.files.map((f) => setLinkSharing(user.id, f.id, false).catch(() => {})));
  const db = await getDb();
  await db.delete(schema.portfolioItems).where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id)));
  refresh();
  redirect("/portfolio");
}

/** Links a file that was just uploaded to Drive (shared right away if the item is public). */
export async function attachPortfolioFile(id: number, fileId: string) {
  const user = await requireUser();
  if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error("Invalid file id");
  const item = await getItem(user.id, id);
  const meta = await getFileMeta(user.id, fileId);
  const file: DriveFile = { id: meta.id, name: meta.name, mimeType: meta.mimeType, webViewLink: meta.webViewLink, thumbnailLink: meta.thumbnailLink };
  if (item.public) await setLinkSharing(user.id, file.id, true);
  const files = [...item.files.filter((f) => f.id !== file.id), file];
  const db = await getDb();
  await db.update(schema.portfolioItems).set({ files, updatedAt: new Date() }).where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id)));
  refresh(id);
}

/** Removes a file from the item (it stays in your Drive, private). */
export async function detachPortfolioFile(id: number, fileId: string) {
  const user = await requireUser();
  const item = await getItem(user.id, id);
  if (item.public) await setLinkSharing(user.id, fileId, false).catch(() => {});
  const db = await getDb();
  await db
    .update(schema.portfolioItems)
    .set({ files: item.files.filter((f) => f.id !== fileId), coverFileId: item.coverFileId === fileId ? null : item.coverFileId, updatedAt: new Date() })
    .where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id)));
  refresh(id);
}

export async function setPortfolioCover(id: number, fileId: string) {
  const user = await requireUser();
  const item = await getItem(user.id, id);
  if (!item.files.some((f) => f.id === fileId)) throw new Error("That file isn't in this item");
  const db = await getDb();
  await db.update(schema.portfolioItems).set({ coverFileId: fileId, updatedAt: new Date() }).where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id)));
  refresh(id);
}

/** Public items show on the share page; their files get (or lose) a view-only Drive link. */
export async function setPortfolioPublic(id: number, on: boolean) {
  const user = await requireUser();
  const item = await getItem(user.id, id);
  await Promise.all(item.files.map((f) => setLinkSharing(user.id, f.id, on)));
  const db = await getDb();
  await db.update(schema.portfolioItems).set({ public: on, updatedAt: new Date() }).where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id)));
  refresh(id);
}

export async function setShareEnabled(on: boolean) {
  const user = await requireUser();
  await saveShare(user.id, { ...(await getShare(user.id)), enabled: on });
  refresh();
}

/** A new address for the share page; the old link stops working. */
export async function resetShareLink() {
  const user = await requireUser();
  await saveShare(user.id, { ...(await getShare(user.id)), token: newShareToken() });
  refresh();
}
