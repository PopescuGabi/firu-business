import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { canJoin, signInUser } from "@/lib/users";

// Local development only: sign in without Google (as the owner, or as an invited email to test accounts).
export async function POST(req: NextRequest) {
  if (!env.devLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") || env.allowedEmail()).trim().toLowerCase();
  if (!(await canJoin(email))) return NextResponse.redirect(`${env.appUrl()}/login?error=not_invited`, 303);
  const user = await signInUser({ email });
  const res = NextResponse.redirect(`${env.appUrl()}${user.onboarded ? "/" : "/onboarding"}`, 303);
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ uid: user.id, email: user.email }, env.sessionSecret()), sessionCookieOptions);
  return res;
}
