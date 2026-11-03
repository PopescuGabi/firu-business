import { eq } from "drizzle-orm";
import { apiUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

/** Your background photo. The address carries its upload time, so browsers can keep it for good. */
export async function GET() {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const db = await getDb();
  const [row] = await db.select().from(schema.backgrounds).where(eq(schema.backgrounds.userId, user.id));
  if (!row) return new Response("No background", { status: 404 });
  return new Response(Buffer.from(row.data, "base64"), {
    headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
