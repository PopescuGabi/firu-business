import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { exchangeCode, getProfile } from "@/lib/instagram/api";
import { saveConnection, syncAccount } from "@/lib/instagram/sync";

export const maxDuration = 300;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Instagram sends the person back here after they allow access. Saves the account, then the first sync runs in the background. */
export async function GET(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const url = new URL(req.url);
  const jar = await cookies();
  const state = jar.get("ig_state")?.value ?? "";
  let target: { clientId: number | null; back: string } = { clientId: null, back: "/instagram" };
  try {
    target = { ...target, ...JSON.parse(jar.get("ig_target")?.value ?? "{}") };
  } catch {
    // keep the defaults
  }
  const back = (flag: string) => {
    const r = NextResponse.redirect(new URL(`${target.back}${target.back.includes("?") ? "&" : "?"}ig=${flag}`, url));
    r.cookies.delete({ name: "ig_state", path: "/api/instagram" });
    r.cookies.delete({ name: "ig_target", path: "/api/instagram" });
    return r;
  };
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code || !state || !same(state, url.searchParams.get("state") ?? "")) return back("failed");

  let clientId: number | null = null;
  if (target.clientId) {
    const db = await getDb();
    const [c] = await db.select({ id: schema.clients.id }).from(schema.clients).where(and(eq(schema.clients.id, target.clientId), eq(schema.clients.userId, user.id)));
    clientId = c?.id ?? null;
  }
  try {
    const { token, expiresAt } = await exchangeCode(code.replace(/#_$/, ""));
    const profile = await getProfile(token);
    if (profile.account_type && !["BUSINESS", "MEDIA_CREATOR"].includes(profile.account_type)) return back("personal");
    const account = await saveConnection(user.id, clientId, token, expiresAt, profile);
    after(() => syncAccount(account.id, user.id, { backfill: true }).catch(() => {}));
    return back("connected");
  } catch {
    return back("failed");
  }
}
