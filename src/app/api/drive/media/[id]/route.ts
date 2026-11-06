import { and, eq, sql } from "drizzle-orm";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { googleFetch } from "@/lib/google/oauth";

export const maxDuration = 300;

/**
 * Streams a reel's attached Drive file (fetched as you) so the AI video maker can play and render it in the browser.
 * Same-origin, so the in-browser renderer can read the pixels. Only files attached to one of your reels; Range requests pass through.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[\w-]{10,200}$/.test(id)) return new Response("Bad id", { status: 400 });
  const db = await getDb();
  const [owned] = await db
    .select({ id: schema.reels.id })
    .from(schema.reels)
    .where(and(eq(schema.reels.userId, user.id), sql`${schema.reels.files} @> ${JSON.stringify([{ id }])}::jsonb`))
    .limit(1);
  if (!owned) return new Response("Not found", { status: 404 });
  try {
    const range = req.headers.get("range");
    const res = await googleFetch(user.id, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: range ? { Range: range } : {} });
    const headers = new Headers({ "Cache-Control": "private, max-age=3600", "Accept-Ranges": "bytes" });
    for (const h of ["content-type", "content-length", "content-range"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(res.body, { status: res.status, headers });
  } catch {
    return new Response("Couldn't load the file from Drive", { status: 502 });
  }
}
