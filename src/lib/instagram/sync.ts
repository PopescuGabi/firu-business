import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { decrypt, encrypt } from "../crypto";
import { getDb, schema } from "../db";
import { accountDay, getProfile, IgError, listMedia, mediaInsights, refreshToken, type IgProfile } from "./api";
import { dayTotals, kindOf, mediaMetrics, type IgKind } from "./parse";

type Account = typeof schema.instagramAccounts.$inferSelect;

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
const daysBack = (n: number) => Array.from({ length: n }, (_, i) => utcDay(new Date(Date.now() - (i + 1) * 86_400_000)));

/** Saves (or re-connects) an account after the Instagram sign-in, owned by `uid`, optionally for one of their clients. */
export async function saveConnection(uid: number, clientId: number | null, token: string, expiresAt: Date, p: IgProfile) {
  const db = await getDb();
  const values = {
    userId: uid,
    clientId,
    igUserId: String(p.user_id),
    appUserId: p.id ? String(p.id) : null,
    username: p.username,
    name: p.name ?? "",
    picture: p.profile_picture_url ?? null,
    accountType: p.account_type ?? "",
    accessToken: encrypt(token),
    tokenExpiresAt: expiresAt,
    status: "ok",
    lastError: null,
  };
  const [row] = await db
    .insert(schema.instagramAccounts)
    .values(values)
    .onConflictDoUpdate({ target: [schema.instagramAccounts.userId, schema.instagramAccounts.igUserId], set: values })
    .returning();
  return row;
}

/** A usable token for the account, refreshed when it has less than 10 days left. */
async function tokenFor(a: Account) {
  const db = await getDb();
  let token = decrypt(a.accessToken);
  if (a.tokenExpiresAt.getTime() < Date.now()) throw new IgError("The Instagram connection expired. Connect the account again.", 190, 401);
  const age = Date.now() - a.createdAt.getTime();
  if (a.tokenExpiresAt.getTime() - Date.now() < 10 * 86_400_000 && age > 86_400_000) {
    const fresh = await refreshToken(token);
    token = fresh.token;
    await db
      .update(schema.instagramAccounts)
      .set({ accessToken: encrypt(token), tokenExpiresAt: fresh.expiresAt })
      .where(and(eq(schema.instagramAccounts.id, a.id), eq(schema.instagramAccounts.userId, a.userId)));
  }
  return token;
}

/** Runs `fn` over `items`, `n` at a time (keeps within Instagram's rate limits and the function's time). */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/**
 * Pulls the account into our tables: today's follower count, recent posts with their insights and daily
 * totals. First run (`backfill`) goes 30 days back; the daily run re-reads the last 3 days (Instagram can lag 48 h).
 */
export async function syncAccount(accountId: number, uid: number, { backfill = false } = {}) {
  const db = await getDb();
  const [a] = await db.select().from(schema.instagramAccounts).where(and(eq(schema.instagramAccounts.id, accountId), eq(schema.instagramAccounts.userId, uid)));
  if (!a) throw new IgError("Account not found", undefined, 404);
  try {
    const token = await tokenFor(a);
    const profile = await getProfile(token);
    const today = utcDay();
    await db
      .insert(schema.igDaily)
      .values({ userId: uid, accountId: a.id, date: today, followers: profile.followers_count ?? null })
      .onConflictDoUpdate({ target: [schema.igDaily.accountId, schema.igDaily.date], set: { followers: profile.followers_count ?? null } });

    // Posts: insights for new posts, posts from the last 30 days (numbers still moving) and any still without numbers.
    const media = await listMedia(token, backfill ? 300 : 100);
    const known = media.length
      ? await db
          .select({ mediaId: schema.igMedia.mediaId, syncedAt: schema.igMedia.syncedAt, postedAt: schema.igMedia.postedAt, metrics: schema.igMedia.metrics })
          .from(schema.igMedia)
          .where(and(eq(schema.igMedia.userId, uid), eq(schema.igMedia.accountId, a.id), inArray(schema.igMedia.mediaId, media.map((m) => m.id))))
      : [];
    const recent = Date.now() - 30 * 86_400_000;
    const todo = media
      .filter((m) => {
        const k = known.find((x) => x.mediaId === m.id);
        return !k || Date.parse(m.timestamp) > recent || k.metrics.reach === null;
      })
      .slice(0, backfill ? 120 : 60);
    await pool(todo, 4, async (m) => {
      const kind = kindOf(m) as IgKind;
      const metrics = mediaMetrics(await mediaInsights(token, m.id, kind), m);
      const values = {
        userId: uid,
        accountId: a.id,
        mediaId: m.id,
        kind,
        caption: (m.caption ?? "").slice(0, 500),
        permalink: m.permalink ?? "",
        thumbnail: m.thumbnail_url ?? m.media_url ?? null,
        postedAt: new Date(m.timestamp),
        metrics,
        syncedAt: new Date(),
      };
      await db.insert(schema.igMedia).values({ ...values, userId: uid }).onConflictDoUpdate({ target: [schema.igMedia.accountId, schema.igMedia.mediaId], set: values });
    });
    // Posts Instagram no longer lists (deleted) keep their last numbers; thumbnails of the rest are refreshed above.

    // Daily totals.
    await pool(daysBack(backfill ? 30 : 3), 3, async (date) => {
      const { main, follows } = await accountDay(token, a.igUserId, date);
      const t = dayTotals(main, follows);
      await db
        .insert(schema.igDaily)
        .values({ userId: uid, accountId: a.id, date, ...t })
        .onConflictDoUpdate({ target: [schema.igDaily.accountId, schema.igDaily.date], set: t });
    });

    await db
      .update(schema.instagramAccounts)
      .set({ lastSyncAt: new Date(), status: "ok", lastError: null, username: profile.username, picture: profile.profile_picture_url ?? a.picture, name: profile.name ?? a.name })
      .where(and(eq(schema.instagramAccounts.id, a.id), eq(schema.instagramAccounts.userId, uid)));
    return { posts: todo.length };
  } catch (err) {
    const expired = err instanceof IgError && err.code === 190;
    await db
      .update(schema.instagramAccounts)
      .set({ status: expired ? "expired" : "error", lastError: err instanceof Error ? err.message.slice(0, 300) : "Sync failed" })
      .where(and(eq(schema.instagramAccounts.id, a.id), eq(schema.instagramAccounts.userId, uid)));
    throw err;
  }
}

/** The daily job: every account not synced in the last 20 hours. */
export async function syncAll() {
  const db = await getDb();
  const due = await db
    .select({ id: schema.instagramAccounts.id, userId: schema.instagramAccounts.userId })
    // scoped: the cron runs for every account; each sync then works only inside that account's own user.
    .from(schema.instagramAccounts)
    .where(and(eq(schema.instagramAccounts.status, "ok"), or(isNull(schema.instagramAccounts.lastSyncAt), lt(schema.instagramAccounts.lastSyncAt, sql`now() - interval '20 hours'`))));
  const results: { id: number; ok: boolean }[] = [];
  for (const a of due) {
    try {
      await syncAccount(a.id, a.userId);
      results.push({ id: a.id, ok: true });
    } catch {
      results.push({ id: a.id, ok: false });
    }
  }
  return results;
}

/** Disconnect: removes the account and (by cascade) every post and day stored for it. */
export async function deleteAccount(accountId: number, uid: number) {
  const db = await getDb();
  await db.delete(schema.instagramAccounts).where(and(eq(schema.instagramAccounts.id, accountId), eq(schema.instagramAccounts.userId, uid)));
}

/** Meta's data-deletion request for an Instagram user: removes that account everywhere it's connected. */
export async function deleteByIgUser(igId: string) {
  const db = await getDb();
  // scoped: Meta asks to delete one Instagram user's data across all hubs that connected it.
  const gone = await db.delete(schema.instagramAccounts).where(or(eq(schema.instagramAccounts.igUserId, igId), eq(schema.instagramAccounts.appUserId, igId))).returning({ id: schema.instagramAccounts.id });
  return gone.length;
}
