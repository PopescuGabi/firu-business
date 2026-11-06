import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "./db";
import { decrypt, encrypt } from "./crypto";
import { env } from "./env";
import { ALL_MODULES, isModule } from "./modules";
import { DEFAULT_ALLOWANCE_USD } from "./ai/allowance";

const normal = (email: string) => email.trim().toLowerCase();

/** Who may sign in: the owner, or someone the owner invited. */
export async function canJoin(email: string) {
  const e = normal(email);
  if (e === env.allowedEmail()) return true;
  const db = await getDb();
  const [[user], [invite]] = await Promise.all([
    db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, e)),
    db.select().from(schema.invites).where(eq(schema.invites.email, e)),
  ]);
  return Boolean(user || invite);
}

/** Creates (first sign-in) or refreshes the person's account; returns it. */
export async function signInUser(profile: { email: string; name?: string; picture?: string }) {
  const db = await getDb();
  const email = normal(profile.email);
  const isOwner = email === env.allowedEmail();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) {
    const [row] = await db
      .update(schema.users)
      .set({ name: profile.name ?? existing.name, picture: profile.picture ?? existing.picture, lastSeenAt: new Date() })
      .where(eq(schema.users.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(schema.users)
    .values({
      email,
      name: profile.name,
      picture: profile.picture,
      role: isOwner ? "owner" : "member",
      // The owner starts with everything; others choose their sections on first sign-in.
      modules: isOwner ? ALL_MODULES : [],
      onboarded: isOwner,
      lastSeenAt: new Date(),
    })
    .returning();
  await db.update(schema.invites).set({ acceptedAt: new Date() }).where(eq(schema.invites.email, email));
  return row;
}

export async function listMembers() {
  const db = await getDb();
  const [users, invites] = await Promise.all([
    db.select().from(schema.users).orderBy(asc(schema.users.id)),
    db.select().from(schema.invites).orderBy(asc(schema.invites.invitedAt)),
  ]);
  const joined = new Set(users.map((u) => u.email));
  return { users, pending: invites.filter((i) => !joined.has(i.email)) };
}

export async function invite(email: string) {
  const e = normal(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("That doesn't look like an email address");
  const db = await getDb();
  await db.insert(schema.invites).values({ email: e }).onConflictDoNothing();
}

export async function cancelInvite(email: string) {
  const db = await getDb();
  await db.delete(schema.invites).where(eq(schema.invites.email, normal(email)));
}

/** Deletes a person and (by cascade) everything they stored. Their Google files stay in their Google account. */
export async function deleteUser(uid: number) {
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, uid));
  if (!u) return;
  if (u.role === "owner") throw new Error("The owner account can't be deleted here.");
  await db.delete(schema.invites).where(eq(schema.invites.email, u.email));
  await db.delete(schema.users).where(and(eq(schema.users.id, uid), ne(schema.users.role, "owner")));
}

export async function setModules(uid: number, modules: string[], onboarded = true) {
  const db = await getDb();
  await db
    .update(schema.users)
    .set({ modules: [...new Set(modules.filter(isModule))], onboarded })
    .where(eq(schema.users.id, uid));
}

// The hub's Anthropic key: the owner's (encrypted), used for everyone's AI. Members don't bring their own.
export async function setAnthropicKey(uid: number, key: string | null) {
  const db = await getDb();
  await db.update(schema.users).set({ anthropicKey: key ? encrypt(key) : null }).where(eq(schema.users.id, uid));
}

export async function anthropicKeyFor(_uid: number) {
  const db = await getDb();
  const [owner] = await db.select({ key: schema.users.anthropicKey }).from(schema.users).where(eq(schema.users.role, "owner")).orderBy(asc(schema.users.id)).limit(1);
  if (owner?.key) return decrypt(owner.key);
  return process.env.ANTHROPIC_API_KEY || null;
}

/** Each member's monthly AI allowance in USD, set by the owner in Settings → Members. */
export async function aiAllowanceUsd() {
  const db = await getDb();
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .innerJoin(schema.users, eq(schema.users.id, schema.settings.userId))
    .where(and(eq(schema.users.role, "owner"), eq(schema.settings.key, "aiAllowanceUsd")));
  const v = Number(row?.value);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_ALLOWANCE_USD;
}

// Their own Google Maps key (encrypted); never sent to the browser.
export async function setMapsKey(uid: number, key: string | null) {
  const db = await getDb();
  await db.update(schema.users).set({ mapsKey: key ? encrypt(key) : null }).where(eq(schema.users.id, uid));
}

export async function mapsKeyFor(uid: number) {
  const db = await getDb();
  const [u] = await db.select({ key: schema.users.mapsKey }).from(schema.users).where(eq(schema.users.id, uid));
  return u?.key ? decrypt(u.key) : null;
}

export const newShareToken = () => randomBytes(18).toString("base64url");

/** Which sections this person uses (for lib code that only has their id). */
export async function modulesOf(uid: number): Promise<string[]> {
  const db = await getDb();
  const [u] = await db.select({ modules: schema.users.modules }).from(schema.users).where(eq(schema.users.id, uid));
  return u?.modules ?? [];
}
