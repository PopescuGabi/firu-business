import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { authorizeUrl, instagramConfigured } from "@/lib/instagram/api";
import { linkFor } from "@/lib/client-links";

/** Starts "Connect Instagram": your own account (?for=own), one of your clients (?for=client:12), or yours for a shared dashboard (?for=link:3). */
export async function GET(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const url = new URL(req.url);
  const back = /^\/[\w\-/?=&]*$/.test(url.searchParams.get("back") ?? "") ? url.searchParams.get("back")! : "/instagram";
  if (!instagramConfigured()) return NextResponse.redirect(new URL(`${back}${back.includes("?") ? "&" : "?"}ig=not_configured`, url));
  const target = url.searchParams.get("for") ?? "own";
  let clientId: number | null = null;
  let linkId: number | null = null;
  if (target.startsWith("link:")) {
    // Your own account, connected for the dashboard a business shares with you (only that business sees it).
    const link = await linkFor(user.id, Number(target.slice(5)));
    if (!link) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    linkId = link.id;
  } else if (target.startsWith("client:")) {
    clientId = Number(target.slice(7));
    const db = await getDb();
    const [c] = await db.select({ id: schema.clients.id }).from(schema.clients).where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, user.id)));
    if (!c) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(state));
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/instagram", maxAge: 600 };
  res.cookies.set("ig_state", state, opts);
  res.cookies.set("ig_target", JSON.stringify({ clientId, linkId, back }), opts);
  return res;
}
