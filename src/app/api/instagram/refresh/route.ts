import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { IgError } from "@/lib/instagram/api";
import { syncAccount } from "@/lib/instagram/sync";

export const maxDuration = 300;

/** "Refresh now" (at most once every 15 minutes per account). */
export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = z.object({ accountId: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const db = await getDb();
  const [a] = await db.select().from(schema.instagramAccounts).where(and(eq(schema.instagramAccounts.id, parsed.data.accountId), eq(schema.instagramAccounts.userId, user.id)));
  if (!a) return Response.json({ error: "Account not found" }, { status: 404 });
  if (a.lastSyncAt && Date.now() - a.lastSyncAt.getTime() < 15 * 60_000) return Response.json({ error: "Updated less than 15 minutes ago. Try again a bit later." }, { status: 429 });
  try {
    const r = await syncAccount(a.id, user.id, { backfill: !a.lastSyncAt });
    return Response.json({ ok: true, ...r });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: err instanceof IgError ? err.status : 500 });
  }
}
