import "server-only";
import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "./db";

export type Place = typeof schema.places.$inferSelect;

/** This person's saved addresses, by travel-time place name. */
export const listPlaces = cache(async (uid: number) => {
  const db = await getDb();
  return db.select().from(schema.places).where(eq(schema.places.userId, uid)).orderBy(asc(schema.places.name));
});

export async function placeMap(uid: number) {
  return new Map((await listPlaces(uid)).map((p) => [p.name, p]));
}

export async function savePlace(uid: number, name: string, p: { address: string; lat: number; lng: number; placeId?: string }) {
  const db = await getDb();
  const values = { address: p.address, lat: p.lat, lng: p.lng, googlePlaceId: p.placeId ?? null, updatedAt: new Date() };
  await db
    .insert(schema.places)
    .values({ userId: uid, name, ...values })
    .onConflictDoUpdate({ target: [schema.places.userId, schema.places.name], set: values });
}

export async function deletePlace(uid: number, name: string) {
  const db = await getDb();
  await db.delete(schema.places).where(and(eq(schema.places.userId, uid), eq(schema.places.name, name)));
}
