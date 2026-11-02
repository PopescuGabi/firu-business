import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "../env";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function getUser() {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value, env.sessionSecret());
  if (!session) return null;
  // Re-check the allow-list on every request so changing ALLOWED_EMAIL revokes old sessions.
  if (session.email.toLowerCase() !== env.allowedEmail()) return null;
  return session;
}

/** Use at the top of every page, server action and route handler. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export class UnauthorizedError extends Error {}

export async function requireApiUser() {
  const user = await getUser();
  if (!user) throw new UnauthorizedError("Not signed in");
  return user;
}
