import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "hub_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(email: string, secret: string) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .setAudience("personal-hub")
    .sign(key(secret));
}

export async function verifySessionToken(token: string | undefined, secret: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      audience: "personal-hub",
    });
    return typeof payload.email === "string" ? { email: payload.email } : null;
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
