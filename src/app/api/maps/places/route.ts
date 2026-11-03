import { apiUser } from "@/lib/auth";
import { autocomplete, MapsError } from "@/lib/google/maps";

/** Address suggestions while typing (Google Places, with your own key). */
export async function GET(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const session = (url.searchParams.get("s") ?? "").slice(0, 64);
  if (q.length < 3) return Response.json({ suggestions: [] });
  try {
    return Response.json({ suggestions: await autocomplete(user.id, q, session) });
  } catch (err) {
    const status = err instanceof MapsError ? err.status : 500;
    return Response.json({ error: err instanceof Error ? err.message : "Search failed" }, { status });
  }
}
