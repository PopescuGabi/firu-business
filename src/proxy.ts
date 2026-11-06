import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Cron and Meta's data-deletion callback check their own secret / signature.
const PUBLIC = ["/login", "/welcome", "/privacy", "/terms", "/api/auth/google", "/api/auth/callback", "/api/auth/dev", "/api/cron/instagram", "/api/instagram/deletion"];

// Simple per-IP limiter for API calls (each instance keeps its own window).
const hits = new Map<string, { count: number; reset: number }>();
const API_LIMIT_PER_MIN = 120;

function rateLimited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.count++;
  return h.count > API_LIMIT_PER_MIN;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    // Block cross-site requests that change data.
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.get("origin");
      if (origin && origin !== req.nextUrl.origin && origin !== process.env.APP_URL) {
        return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
      }
    }
  }

  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  // Public portfolio pages (they check the share token and only show items marked public).
  if (pathname.startsWith("/share/")) return NextResponse.next();
  // Google Search Console ownership file (public/googleXXXX.html).
  if (/^\/google[0-9a-f]+\.html$/.test(pathname)) return NextResponse.next();

  const secret = process.env.SESSION_SECRET ?? "";
  const session = secret.length >= 32
    ? await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;
  // A valid session; the page or route then checks the account still exists (lib/auth getUser).
  if (session) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = req.nextUrl.clone();
  // Logged-out visitors to the site address see the public homepage (same URL, for Google's review).
  if (pathname === "/") {
    url.pathname = "/welcome";
    return NextResponse.rewrite(url);
  }
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|google[0-9a-f]+\\.html).*)"],
};
