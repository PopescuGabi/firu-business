import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CarouselEditor } from "@/components/carousel-editor";
import { ItemFeedback } from "@/components/item-feedback";
import { requireModule } from "@/lib/sections";
import { getDb, schema } from "@/lib/db";
import { getEditorData } from "@/lib/editor-data";

export const metadata = { title: "Carousel" };

export default async function CarouselPage({ params }: { params: Promise<{ id: string; carouselId: string }> }) {
  const { id, carouselId } = await params;
  const user = await requireModule("clients");
  const db = await getDb();
  const [carousel] = await db
    .select()
    .from(schema.carousels)
    .where(and(eq(schema.carousels.id, Number(carouselId) || 0), eq(schema.carousels.clientId, Number(id) || 0), eq(schema.carousels.userId, user.id)));
  if (!carousel) notFound();
  const [client] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, carousel.clientId), eq(schema.clients.userId, user.id)));
  if (!client) notFound();
  const data = await getEditorData(user.id, "carousel", carousel.id);
  return (
    <>
      <CarouselEditor key={carousel.id} carousel={carousel} clientName={client.name} {...data} />
      <ItemFeedback targetType="carousel" targetId={carousel.id} />
    </>
  );
}
