import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAuthRequest, GMAIL_SCOPES } from "@/lib/google/oauth";

// ?gmail=1 (signed in): ask for Gmail on top of what was granted before, then come back to the Email page.
export async function GET(req: NextRequest) {
  if (!env.googleConfigured()) {
    return NextResponse.redirect(`${env.appUrl()}/login?error=google_not_configured`);
  }
  const gmail = req.nextUrl.searchParams.get("gmail") === "1";
  const user = gmail ? await getUser() : null;
  const { url, state, verifier } = createAuthRequest(gmail && user ? { extra: GMAIL_SCOPES, loginHint: user.email } : {});
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
  res.cookies.set("oauth_next", gmail && user ? "/email" : "/", opts);
  return res;
}
