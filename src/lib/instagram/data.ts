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

/** This person's own accounts: everything they connected except accounts of their own clients. */
export async function ownAccounts(uid: number): Promise<IgAccount[]> {
  const db = await getDb();
  const mine = new Set((await db.select({ id: schema.clients.id }).from(schema.clients).where(eq(schema.clients.userId, uid))).map((c) => c.id));
  return (await allAccounts(uid)).filter((a) => a.clientId === null || !mine.has(a.clientId));
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

export type IgSnapshot = { accountId: number; username: string; followers: number | null; reach30: number | null; spark: number[]; status: string };

/** For the clients overview: each client's connected account with followers and the last 30 days of reach. */
export async function clientSnapshots(uid: number): Promise<Map<number, IgSnapshot>> {
  const db = await getDb();
  const accounts = (await allAccounts(uid)).filter((a) => a.clientId !== null);
  const out = new Map<number, IgSnapshot>();
  if (!accounts.length) return out;
  const since = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
  const days = await db
    .select({ accountId: schema.igDaily.accountId, date: schema.igDaily.date, followers: schema.igDaily.followers, reach: schema.igDaily.reach })
    .from(schema.igDaily)
    .where(and(eq(schema.igDaily.userId, uid), gte(schema.igDaily.date, since)))
    .orderBy(asc(schema.igDaily.date));
  for (const a of accounts) {
    if (out.has(a.clientId!)) continue;
    const mine = days.filter((d) => d.accountId === a.id);
    const reach = mine.map((d) => d.reach).filter((v): v is number => v !== null);
    out.set(a.clientId!, {
      accountId: a.id,
      username: a.username,
      followers: [...mine].reverse().find((d) => d.followers !== null)?.followers ?? null,
      reach30: reach.length ? reach.reduce((x, y) => x + y, 0) : null,
      spark: reach,
      status: a.status,
    });
  }
  return out;
}
