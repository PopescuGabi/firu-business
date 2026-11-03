import { notSignedIn } from "@/lib/auth";
import { fetchThumbnail } from "@/lib/google/drive";

/** A Drive file's preview image, fetched as you, for the private Portfolio tab. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await notSignedIn();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[\w-]{10,200}$/.test(id)) return new Response("Bad id", { status: 400 });
  const size = Math.min(1600, Math.max(200, Number(new URL(req.url).searchParams.get("s")) || 800));
  try {
    const thumb = await fetchThumbnail(id, size);
    if (!thumb?.body) return new Response("No preview", { status: 404 });
    return new Response(thumb.body, { headers: { "Content-Type": thumb.type, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("No preview", { status: 404 });
  }
}
