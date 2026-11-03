import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { exchangeCode, saveGoogleAccount } from "@/lib/google/oauth";
import { canJoin, signInUser } from "@/lib/users";

function fail(reason: string) {
  const res = NextResponse.redirect(`${env.appUrl()}/login?error=${reason}`);
  res.cookies.delete({ name: "oauth_state", path: "/api/auth" });
  res.cookies.delete({ name: "oauth_verifier", path: "/api/auth" });
  res.cookies.delete({ name: "oauth_next", path: "/api/auth" });
  return res;
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const state = req.cookies.get("oauth_state")?.value;
  const verifier = req.cookies.get("oauth_verifier")?.value;
  const code = params.get("code");
  if (params.get("error")) return fail("google_denied");
  if (!code || !state || !verifier || !same(state, params.get("state") ?? "")) {
    return fail("invalid_state");
  }
  try {
    const { tokens, profile } = await exchangeCode(code, verifier);
    if (!profile.email_verified) return fail("not_allowed");
    // Invite only: the owner, or someone the owner invited.
    if (!(await canJoin(profile.email))) return fail("not_invited");
    const user = await signInUser(profile);
    await saveGoogleAccount(user.id, tokens, profile);
    const next = req.cookies.get("oauth_next")?.value === "/email" ? "/email" : "/";
    const res = NextResponse.redirect(`${env.appUrl()}${user.onboarded ? next : "/onboarding"}`);
    res.cookies.set(SESSION_COOKIE, await createSessionToken({ uid: user.id, email: user.email }, env.sessionSecret()), sessionCookieOptions);
    res.cookies.delete({ name: "oauth_state", path: "/api/auth" });
    res.cookies.delete({ name: "oauth_verifier", path: "/api/auth" });
    res.cookies.delete({ name: "oauth_next", path: "/api/auth" });
    return res;
  } catch (err) {
    console.error("OAuth callback failed", err);
    return fail("oauth_failed");
  }
}
