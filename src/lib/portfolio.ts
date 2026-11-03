import "server-only";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { newShareToken } from "./users";

export { coverOf, PORTFOLIO_TYPES, typeLabel, type PortfolioType } from "./portfolio-types";

// The public share page: off until you turn it on; the token makes the address unguessable.
type Share = { enabled: boolean; token: string };

export async function getShare(uid: number): Promise<Share> {
  const db = await getDb();
  const [u] = await db.select({ token: schema.users.shareToken, enabled: schema.users.shareEnabled }).from(schema.users).where(eq(schema.users.id, uid));
  if (u?.token) return { enabled: u.enabled, token: u.token };
  const token = newShareToken();
  await db.update(schema.users).set({ shareToken: token }).where(eq(schema.users.id, uid));
  return { enabled: Boolean(u?.enabled), token };
}

export async function saveShare(uid: number, share: Share) {
  const db = await getDb();
  await db.update(schema.users).set({ shareToken: share.token, shareEnabled: share.enabled }).where(eq(schema.users.id, uid));
}

export { newShareToken };

/** The person behind a share link, or null when the link is wrong or their page is off. */
async function shareOwner(token: string) {
  if (!/^[\w-]{20,40}$/.test(token)) return null;
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.shareToken, token));
  if (!u?.shareToken || !u.shareEnabled) return null;
  const ok = timingSafeEqual(Buffer.from(token), Buffer.from(u.shareToken));
  return ok ? u : null;
}

/** Public items for a share link, or null when the link is wrong or sharing is off. */
export async function publicPortfolio(token: string) {
  const owner = await shareOwner(token);
  if (!owner) return null;
  const db = await getDb();
  const [items, clients] = await Promise.all([
    db
      .select()
      .from(schema.portfolioItems)
      .where(and(eq(schema.portfolioItems.userId, owner.id), eq(schema.portfolioItems.public, true)))
      .orderBy(desc(schema.portfolioItems.date), desc(schema.portfolioItems.id)),
    db.select({ id: schema.clients.id, name: schema.clients.name, color: schema.clients.color }).from(schema.clients).where(eq(schema.clients.userId, owner.id)),
  ]);
  return { items, clients, owner: { id: owner.id, name: owner.name } };
}

export async function publicItem(token: string, id: number) {
  const data = await publicPortfolio(token);
  if (!data) return null;
  const item = data.items.find((i) => i.id === id);
  return item ? { item, clients: data.clients, owner: data.owner } : null;
}
