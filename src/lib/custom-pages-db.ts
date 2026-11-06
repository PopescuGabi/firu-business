import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { LIMITS, slugPage, type ItemData, type PageDraft } from "./custom-pages";

export type CustomPage = typeof schema.customPages.$inferSelect;
export type CustomItem = typeof schema.customItems.$inferSelect;

/** This person's pages, in nav order. */
export async function listPages(uid: number) {
  const db = await getDb();
  return db.select().from(schema.customPages).where(eq(schema.customPages.userId, uid)).orderBy(asc(schema.customPages.position), asc(schema.customPages.id));
}

export async function getPage(uid: number, slug: string) {
  const db = await getDb();
  const [page] = await db.select().from(schema.customPages).where(and(eq(schema.customPages.userId, uid), eq(schema.customPages.slug, slug)));
  return page ?? null;
}

export async function getPageById(uid: number, id: number) {
  const db = await getDb();
  const [page] = await db.select().from(schema.customPages).where(and(eq(schema.customPages.userId, uid), eq(schema.customPages.id, id)));
  return page ?? null;
}

export async function pageItems(uid: number, pageId: number) {
  const db = await getDb();
  return db
    .select()
    .from(schema.customItems)
    .where(and(eq(schema.customItems.userId, uid), eq(schema.customItems.pageId, pageId)))
    .orderBy(asc(schema.customItems.position), asc(schema.customItems.id));
}

/** Saves a validated draft as a new page with a free slug (e.g. "shoots-2" if "shoots" exists). */
export async function createPage(uid: number, draft: PageDraft) {
  const db = await getDb();
  const existing = await listPages(uid);
  if (existing.length >= LIMITS.pagesPerPerson) throw new Error(`You can have up to ${LIMITS.pagesPerPerson} custom pages.`);
  const base = slugPage(draft.title);
  let slug = base;
  for (let i = 2; existing.some((p) => p.slug === slug); i++) slug = `${base}-${i}`;
  const position = existing.reduce((m, p) => Math.max(m, p.position + 1), 0);
  const [page] = await db
    .insert(schema.customPages)
    .values({ userId: uid, slug, title: draft.title, icon: draft.icon, color: draft.color, description: draft.description, position, spec: draft.spec })
    .returning();
  return page;
}

export const byCollection = (items: CustomItem[], key: string) => items.filter((i) => i.collection === key);
export const dataOf = (items: CustomItem[]): ItemData[] => items.map((i) => i.data);
