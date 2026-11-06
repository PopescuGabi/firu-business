"use server";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { coerceValue, PAGE_COLORS, PAGE_ICONS, type ItemData } from "@/lib/custom-pages";
import { getPageById } from "@/lib/custom-pages-db";

const id = z.number().int().positive();

async function pageFor(pageId: number) {
  const user = await requireUser();
  const page = await getPageById(user.id, id.parse(pageId));
  if (!page) throw new Error("Page not found");
  return { user, page };
}

async function itemFor(itemId: number) {
  const user = await requireUser();
  const db = await getDb();
  const [item] = await db.select().from(schema.customItems).where(and(eq(schema.customItems.id, id.parse(itemId)), eq(schema.customItems.userId, user.id)));
  if (!item) throw new Error("Not found");
  const page = await getPageById(user.id, item.pageId);
  if (!page) throw new Error("Page not found");
  return { user, item, page, db };
}

/** Form values for one collection's fields, checked against the page spec. Fields not on the form keep their old value. */
function readFields(page: Awaited<ReturnType<typeof getPageById>>, collection: string, fd: FormData, old: ItemData = {}) {
  const c = page!.spec.collections.find((x) => x.key === collection);
  if (!c) throw new Error("Unknown list");
  const data: ItemData = { ...old };
  for (const f of c.fields) {
    if (f.type === "checkbox" ? fd.has(`present:${f.key}`) : fd.has(f.key)) data[f.key] = coerceValue(f, fd.get(f.key));
  }
  if (!String(data[c.titleField] ?? "").trim()) throw new Error(`${c.fields.find((f) => f.key === c.titleField)?.label ?? "Name"} is required`);
  return data;
}

const refresh = (slug: string) => revalidatePath(`/p/${slug}`);

export async function addItem(pageId: number, collection: string, fd: FormData) {
  const { user, page } = await pageFor(pageId);
  const data = readFields(page, collection, fd);
  const db = await getDb();
  const [{ top }] = await db.select({ top: max(schema.customItems.position) }).from(schema.customItems).where(and(eq(schema.customItems.userId, user.id), eq(schema.customItems.pageId, page.id)));
  await db.insert(schema.customItems).values({ userId: user.id, pageId: page.id, collection, data, position: (top ?? 0) + 1 });
  refresh(page.slug);
}

export async function updateItem(itemId: number, fd: FormData) {
  const { user, item, page, db } = await itemFor(itemId);
  const data = readFields(page, item.collection, fd, item.data);
  await db.update(schema.customItems).set({ data, updatedAt: new Date() }).where(and(eq(schema.customItems.id, item.id), eq(schema.customItems.userId, user.id)));
  refresh(page.slug);
}

/** One field at a time: moving a card to another column, ticking a checklist item. */
export async function setItemField(itemId: number, field: string, value: string | boolean) {
  const { user, item, page, db } = await itemFor(itemId);
  const c = page.spec.collections.find((x) => x.key === item.collection);
  const f = c?.fields.find((x) => x.key === field);
  if (!f) throw new Error("Unknown field");
  const v = coerceValue(f, typeof value === "boolean" ? (value ? "on" : "off") : value);
  await db
    .update(schema.customItems)
    .set({ data: { ...item.data, [f.key]: v }, updatedAt: new Date() })
    .where(and(eq(schema.customItems.id, item.id), eq(schema.customItems.userId, user.id)));
  refresh(page.slug);
}

export async function deleteItem(itemId: number) {
  const { user, item, page, db } = await itemFor(itemId);
  await db.delete(schema.customItems).where(and(eq(schema.customItems.id, item.id), eq(schema.customItems.userId, user.id)));
  refresh(page.slug);
}

/** The notes block: one text per block, saved as it's typed. */
export async function saveNote(pageId: number, blockId: string, text: string) {
  const { user, page } = await pageFor(pageId);
  if (!page.spec.blocks.some((b) => b.id === blockId && b.type === "notes")) throw new Error("Unknown block");
  const body = z.string().max(20_000).parse(text);
  const db = await getDb();
  const collection = `note:${blockId}`;
  const [row] = await db
    .select({ id: schema.customItems.id })
    .from(schema.customItems)
    .where(and(eq(schema.customItems.userId, user.id), eq(schema.customItems.pageId, page.id), eq(schema.customItems.collection, collection)));
  if (row) await db.update(schema.customItems).set({ data: { text: body }, updatedAt: new Date() }).where(and(eq(schema.customItems.id, row.id), eq(schema.customItems.userId, user.id)));
  else await db.insert(schema.customItems).values({ userId: user.id, pageId: page.id, collection, data: { text: body } });
}

/** The links block. */
export async function addLink(pageId: number, blockId: string, fd: FormData) {
  const { user, page } = await pageFor(pageId);
  if (!page.spec.blocks.some((b) => b.id === blockId && b.type === "links")) throw new Error("Unknown block");
  const url = z.string().trim().url().max(500).refine((u) => /^https?:\/\//i.test(u), "Use an http(s) link").parse(fd.get("url"));
  const label = z.string().trim().max(80).parse(fd.get("label") ?? "") || new URL(url).hostname;
  const db = await getDb();
  await db.insert(schema.customItems).values({ userId: user.id, pageId: page.id, collection: `links:${blockId}`, data: { label, url } });
  refresh(page.slug);
}

// ── Pages ──

export async function renamePage(pageId: number, fd: FormData) {
  const { user, page } = await pageFor(pageId);
  const values = {
    title: z.string().trim().min(1).max(60).parse(fd.get("title")),
    icon: z.enum(PAGE_ICONS).catch(page.icon as (typeof PAGE_ICONS)[number]).parse(fd.get("icon")),
    color: z.enum(PAGE_COLORS).catch(page.color as (typeof PAGE_COLORS)[number]).parse(fd.get("color")),
  };
  const db = await getDb();
  await db.update(schema.customPages).set({ ...values, updatedAt: new Date() }).where(and(eq(schema.customPages.id, page.id), eq(schema.customPages.userId, user.id)));
  revalidatePath("/", "layout");
}

/** Up or down in the nav. */
export async function movePage(pageId: number, dir: -1 | 1) {
  const { user } = await pageFor(pageId);
  const db = await getDb();
  const pages = await db.select().from(schema.customPages).where(eq(schema.customPages.userId, user.id));
  pages.sort((a, b) => a.position - b.position || a.id - b.id);
  const i = pages.findIndex((p) => p.id === pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  await db.transaction(async (tx) => {
    for (const [pos, p] of pages.entries()) {
      await tx.update(schema.customPages).set({ position: pos }).where(and(eq(schema.customPages.id, p.id), eq(schema.customPages.userId, user.id)));
    }
  });
  revalidatePath("/", "layout");
}

/** Deletes the page and everything on it. */
export async function deletePage(pageId: number) {
  const { user, page } = await pageFor(pageId);
  const db = await getDb();
  await db.delete(schema.customPages).where(and(eq(schema.customPages.id, page.id), eq(schema.customPages.userId, user.id)));
  revalidatePath("/", "layout");
  redirect("/settings#sections");
}
