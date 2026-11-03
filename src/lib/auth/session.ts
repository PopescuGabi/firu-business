import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "hub_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Session = { uid: number; email: string };

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session, secret: string) {
  return new SignJWT({ uid: session.uid, email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .setAudience("personal-hub")
    .sign(key(secret));
}

/** The signed-in person, or null. Sessions from before accounts existed (no uid) count as signed out. */
export async function verifySessionToken(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      audience: "personal-hub",
    });
    return typeof payload.email === "string" && Number.isInteger(payload.uid) ? { uid: payload.uid as number, email: payload.email } : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};
