import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { env } from "../env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export type AppUser = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: "owner" | "member";
  modules: string[];
  onboarded: boolean;
};

/**
 * The signed-in person (once per request), or null. Their account row must still exist:
 * removing a member deletes it, which signs them out everywhere.
 */
export const getUser = cache(async (): Promise<AppUser | null> => {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value, env.sessionSecret());
  if (!session) return null;
  const db = await getDb();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, session.uid));
  if (!row || row.email !== session.email.toLowerCase()) return null;
  return { id: row.id, email: row.email, name: row.name, picture: row.picture, role: row.role, modules: row.modules, onboarded: row.onboarded };
});

/** Use at the top of every page and server action; its `id` scopes every query. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Owner-only tools (members, keys, deployment). */
export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") throw new Error("Only the owner can do that.");
  return user;
}

/** For route handlers: the user, or a 401 response to return. */
export async function apiUser(): Promise<{ user: AppUser; denied: null } | { user: null; denied: Response }> {
  const user = await getUser();
  return user ? { user, denied: null } : { user: null, denied: Response.json({ error: "Not signed in" }, { status: 401 }) };
}
