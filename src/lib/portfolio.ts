import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";

export { coverOf, PORTFOLIO_TYPES, typeLabel, type PortfolioType } from "./portfolio-types";

// The public share page: off until you turn it on; the token makes the address unguessable.
type Share = { enabled: boolean; token: string };
const KEY = "portfolioShare";

export async function getShare(): Promise<Share> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY));
  if (row) return row.value as Share;
  const share = { enabled: false, token: randomBytes(18).toString("base64url") };
  await db.insert(schema.settings).values({ key: KEY, value: share }).onConflictDoNothing();
  return share;
}

export async function saveShare(share: Share) {
  const db = await getDb();
  await db.insert(schema.settings).values({ key: KEY, value: share }).onConflictDoUpdate({ target: schema.settings.key, set: { value: share } });
}

export const newShareToken = () => randomBytes(18).toString("base64url");

/** Public items for a share token, or null when the token is wrong or sharing is off. */
export async function publicPortfolio(token: string) {
  const share = await getShare();
  const ok = token.length === share.token.length && timingSafeEqual(Buffer.from(token), Buffer.from(share.token));
  if (!share.enabled || !ok) return null;
  const db = await getDb();
  const [items, clients] = await Promise.all([
    db.select().from(schema.portfolioItems).where(eq(schema.portfolioItems.public, true)).orderBy(desc(schema.portfolioItems.date), desc(schema.portfolioItems.id)),
    db.select({ id: schema.clients.id, name: schema.clients.name, color: schema.clients.color }).from(schema.clients),
  ]);
  return { items, clients };
}

export async function publicItem(token: string, id: number) {
  const data = await publicPortfolio(token);
  if (!data) return null;
  const db = await getDb();
  const [item] = await db
    .select()
    .from(schema.portfolioItems)
    .where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.public, true)));
  return item ? { item, clients: data.clients } : null;
}
