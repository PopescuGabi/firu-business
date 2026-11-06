import "server-only";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { IgDay, IgPost } from "./stats";

export type IgAccount = Omit<typeof schema.instagramAccounts.$inferSelect, "accessToken">;

const publicCols = {
  id: schema.instagramAccounts.id,
  userId: schema.instagramAccounts.userId,
  clientId: schema.instagramAccounts.clientId,
  igUserId: schema.instagramAccounts.igUserId,
  appUserId: schema.instagramAccounts.appUserId,
  username: schema.instagramAccounts.username,
  name: schema.instagramAccounts.name,
  picture: schema.instagramAccounts.picture,
  accountType: schema.instagramAccounts.accountType,
  tokenExpiresAt: schema.instagramAccounts.tokenExpiresAt,
  status: schema.instagramAccounts.status,
  lastError: schema.instagramAccounts.lastError,
  lastSyncAt: schema.instagramAccounts.lastSyncAt,
  createdAt: schema.instagramAccounts.createdAt,
};

/** Accounts this person connected: their own (clientId null) or one client's. Tokens never leave the server. */
export async function listAccounts(uid: number, clientId: number | null = null): Promise<IgAccount[]> {
  const db = await getDb();
  return db
    .select(publicCols)
    .from(schema.instagramAccounts)
    .where(and(eq(schema.instagramAccounts.userId, uid), clientId === null ? isNull(schema.instagramAccounts.clientId) : eq(schema.instagramAccounts.clientId, clientId)))
    .orderBy(asc(schema.instagramAccounts.id));
}

/** Every account this person connected (for the clients overview). */
export async function allAccounts(uid: number): Promise<IgAccount[]> {
  const db = await getDb();
  return db.select(publicCols).from(schema.instagramAccounts).where(eq(schema.instagramAccounts.userId, uid)).orderBy(asc(schema.instagramAccounts.id));
}

/** Stored posts and days for one account (the last 400 days). */
export async function accountData(uid: number, accountId: number): Promise<{ posts: IgPost[]; days: IgDay[] }> {
  const db = await getDb();
  const since = new Date(Date.now() - 400 * 86_400_000);
  const [media, daily] = await Promise.all([
    db
      .select()
      .from(schema.igMedia)
      .where(and(eq(schema.igMedia.userId, uid), eq(schema.igMedia.accountId, accountId), gte(schema.igMedia.postedAt, since))),
    db
      .select()
      .from(schema.igDaily)
      .where(and(eq(schema.igDaily.userId, uid), eq(schema.igDaily.accountId, accountId), gte(schema.igDaily.date, since.toISOString().slice(0, 10))))
      .orderBy(asc(schema.igDaily.date)),
  ]);
  return {
    posts: media.map((m) => ({
      mediaId: m.mediaId,
      kind: m.kind as IgPost["kind"],
      caption: m.caption,
      permalink: m.permalink,
      thumbnail: m.thumbnail,
      postedAt: m.postedAt.toISOString(),
      metrics: m.metrics,
    })),
    days: daily.map(({ date, followers, reach, views, interactions, likes, comments, shares, saves, follows, unfollows }) => ({
      date,
      followers,
      reach,
      views,
      interactions,
      likes,
      comments,
      shares,
      saves,
      follows,
      unfollows,
    })),
  };
}
