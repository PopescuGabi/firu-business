import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ReelEditor } from "@/components/reel-editor";
import { ItemFeedback } from "@/components/item-feedback";
import { requireModule } from "@/lib/sections";
import { getDb, schema } from "@/lib/db";
import { getEditorData } from "@/lib/editor-data";

export const metadata = { title: "Reel" };

export default async function ReelPage({ params }: { params: Promise<{ id: string; reelId: string }> }) {
  const { id, reelId } = await params;
  const user = await requireModule("clients");
  const db = await getDb();
  const [reel] = await db
    .select()
    .from(schema.reels)
    .where(and(eq(schema.reels.id, Number(reelId) || 0), eq(schema.reels.clientId, Number(id) || 0), eq(schema.reels.userId, user.id)));
  if (!reel) notFound();
  const [client] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, reel.clientId), eq(schema.clients.userId, user.id)));
  if (!client) notFound();
  const data = await getEditorData(user.id, "reel", reel.id);
  return (
    <>
      <ReelEditor key={reel.id} reel={reel} clientName={client.name} {...data} />
      <ItemFeedback targetType="reel" targetId={reel.id} />
    </>
  );
}
