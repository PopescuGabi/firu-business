import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { deleteByIgUser } from "@/lib/instagram/sync";

/**
 * Meta's data-deletion callback: when someone removes the app from their Instagram, Meta posts a signed request here.
 * We check the signature with the app secret, delete that account's data and return a confirmation code.
 */
export async function POST(req: Request) {
  const secret = process.env.INSTAGRAM_APP_SECRET ?? "";
  const form = await req.formData().catch(() => null);
  const signed = String(form?.get("signed_request") ?? "");
  const [sig, payload] = signed.split(".");
  if (!secret || !sig || !payload) return Response.json({ error: "Invalid request" }, { status: 400 });
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Bad signature" }, { status: 400 });
  let data: { user_id?: string | number; algorithm?: string };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (data.algorithm && data.algorithm.toUpperCase() !== "HMAC-SHA256") return Response.json({ error: "Unsupported" }, { status: 400 });
  if (data.user_id) await deleteByIgUser(String(data.user_id));
  const code = randomBytes(8).toString("hex");
  return Response.json({ url: `${env.appUrl()}/privacy#instagram`, confirmation_code: code });
}
