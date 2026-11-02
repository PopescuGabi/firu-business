import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

// Local development only: sign in without Google. Disabled in production builds.
export async function POST() {
  if (!env.devLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  const res = NextResponse.redirect(`${env.appUrl()}/`, 303);
  res.cookies.set(SESSION_COOKIE, await createSessionToken(env.allowedEmail(), env.sessionSecret()), sessionCookieOptions);
  return res;
}
