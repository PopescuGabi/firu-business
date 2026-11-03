import { apiUser } from "@/lib/auth";
import { MapsError, staticMap } from "@/lib/google/maps";

/** The map picture behind a route (night or porcelain style), fetched with your key. */
export async function GET(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const zoom = Number(url.searchParams.get("z"));
  const theme = url.searchParams.get("t") === "light" ? "light" : "dark";
  if (!(Math.abs(lat) <= 85 && Math.abs(lng) <= 180 && Number.isInteger(zoom) && zoom >= 1 && zoom <= 20)) {
    return new Response("Bad map", { status: 400 });
  }
  try {
    const img = await staticMap(user.id, { lat, lng }, zoom, theme);
    return new Response(img.body, { headers: { "Content-Type": img.type, "Cache-Control": "private, max-age=86400" } });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "No map", { status: err instanceof MapsError ? err.status : 500 });
  }
}
