import { timingSafeEqual } from "node:crypto";
import { syncAll } from "@/lib/instagram/sync";

export const maxDuration = 300;

/** Vercel Cron, once a day: yesterday's totals, today's follower count, fresh post numbers, token refresh. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (secret.length < 16 || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }
  const results = await syncAll();
  return Response.json({ synced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
}
