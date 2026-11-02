import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAuthRequest } from "@/lib/google/oauth";

export async function GET() {
  if (!env.googleConfigured()) {
    return NextResponse.redirect(`${env.appUrl()}/login?error=google_not_configured`);
  }
  const { url, state, verifier } = createAuthRequest();
  const res = NextResponse.redirect(url);
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: 600,
  };
  res.cookies.set("oauth_state", state, opts);
  res.cookies.set("oauth_verifier", verifier, opts);
  return res;
}
