import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensurePortfolioFolder, ensureSectionFolder, startResumableUpload } from "@/lib/google/drive";

const file = {
  name: z.string().trim().min(1).max(300),
  mimeType: z.string().max(200).default("application/octet-stream"),
  size: z.number().int().min(0).max(50 * 1024 ** 3), // up to 50 GB
};
// Either into a client's section folder, or into the Portfolio folder.
const body = z.union([
  z.object({ clientId: z.number().int().positive(), section: z.enum(["App", "Reels", "Carousels"]), ...file }),
  z.object({ portfolio: z.literal(true), ...file }),
]);

export async function POST(req: Request) {
  const { user, denied } = await apiUser();
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const parentId = "portfolio" in parsed.data ? await ensurePortfolioFolder(user.id) : await ensureSectionFolder(user.id, parsed.data.clientId, parsed.data.section);
    const uploadUrl = await startResumableUpload(user.id, {
      name: parsed.data.name,
      size: parsed.data.size,
      mimeType: parsed.data.mimeType || "application/octet-stream",
      parentId,
      origin: req.headers.get("origin") ?? env.appUrl(),
    });
    return Response.json({ uploadUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: message }, { status: message.includes("not connected") ? 409 : 502 });
  }
}
