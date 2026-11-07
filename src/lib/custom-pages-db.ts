import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import { LIMITS, slugPage, type ItemData, type PageDraft } from "./custom-pages";

export type CustomPage = typeof schema.customPages.$inferSelect;
export type CustomItem = typeof schema.customItems.$inferSelect;

/** This person's own pages (the side menu), in nav order. A client's own tabs aren't included. */
export async function listPages(uid: number) {
  const db = await getDb();
  return db
    .select()
    .from(schema.customPages)
    .where(and(eq(schema.customPages.userId, uid), isNull(schema.customPages.clientId)))
    .orderBy(asc(schema.customPages.position), asc(schema.customPages.id));
}

/** One client's own tabs (pages tied to that client). */
export async function clientPages(uid: number, clientId: number) {
  const db = await getDb();
  return db
    .select()
    .from(schema.customPages)
    .where(and(eq(schema.customPages.userId, uid), eq(schema.customPages.clientId, clientId)))
    .orderBy(asc(schema.customPages.id));
}

/** At most this many own tabs per client. */
export const TABS_PER_CLIENT = 12;

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

/**
 * Saves a validated draft as a new page with a free slug (e.g. "shoots-2" if "shoots" exists). With `clientId`
 * the page is that client's own tab instead of a page in the menu.
 */
export async function createPage(uid: number, draft: PageDraft, clientId: number | null = null) {
  const db = await getDb();
  // scoped: every page of this person (menu pages and client tabs share the slug space).
  const existing = await db.select().from(schema.customPages).where(eq(schema.customPages.userId, uid));
  const menuPages = existing.filter((p) => p.clientId === null);
  if (clientId === null && menuPages.length >= LIMITS.pagesPerPerson) throw new Error(`You can have up to ${LIMITS.pagesPerPerson} custom pages.`);
  if (clientId !== null && existing.filter((p) => p.clientId === clientId).length >= TABS_PER_CLIENT)
    throw new Error(`A client can have up to ${TABS_PER_CLIENT} own tabs.`);
  const base = slugPage(draft.title);
  let slug = base;
  for (let i = 2; existing.some((p) => p.slug === slug); i++) slug = `${base}-${i}`;
  const position = menuPages.reduce((m, p) => Math.max(m, p.position + 1), 0);
  const [page] = await db
    .insert(schema.customPages)
    .values({ userId: uid, clientId, slug, title: draft.title, icon: draft.icon, color: draft.color, description: draft.description, position, spec: draft.spec })
    .returning();
  return page;
}

export const byCollection = (items: CustomItem[], key: string) => items.filter((i) => i.collection === key);
export const dataOf = (items: CustomItem[]): ItemData[] => items.map((i) => i.data);
