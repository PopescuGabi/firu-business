import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.redirect(`${env.appUrl()}/login`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
