"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { linkFor } from "@/lib/client-links";
import { getDb, schema } from "@/lib/db";
import { clientOverviewKey, HOME_BOARD_KEY as HOME, sharedBoardKey as sharedKey } from "@/lib/board";
import { setSetting } from "@/lib/settings";

// What a saved board may look like (it's cleaned again against the widgets available whenever it's read).
const items = z
  .array(
    z.object({
      i: z.string().min(1).max(120),
      x: z.number().int().min(0).max(12),
      y: z.number().int().min(0).max(1000),
      w: z.number().int().min(1).max(12),
      h: z.number().int().min(1).max(24),
    }),
  )
  .max(80);
const layoutSchema = z.object({ computer: items, tablet: items, phone: items });


async function deleteSetting(uid: number, key: string) {
  const db = await getDb();
  await db.delete(schema.settings).where(and(eq(schema.settings.userId, uid), eq(schema.settings.key, key)));
}

/** Your Home board. */
export async function saveHomeBoard(layout: unknown) {
  const user = await requireUser();
  await setSetting(user.id, HOME, layoutSchema.parse(layout));
}
export async function resetHomeBoard() {
  const user = await requireUser();
  await deleteSetting(user.id, HOME);
}

/** A client's own arrangement of the dashboard a business shares with them (kept in their own settings). */
export async function saveSharedBoard(linkId: number, layout: unknown) {
  const user = await requireUser();
  const link = await linkFor(user.id, z.number().int().positive().parse(linkId));
  if (!link) throw new Error("Not found");
  await setSetting(user.id, sharedKey(link.id), layoutSchema.parse(layout));
}
export async function resetSharedBoard(linkId: number) {
  const user = await requireUser();
  await deleteSetting(user.id, sharedKey(z.number().int().positive().parse(linkId)));
}

/** Your arrangement of a client's Overview tab (only for a client of yours). */
async function ownClientId(uid: number, clientId: number) {
  const id = z.number().int().positive().parse(clientId);
  const db = await getDb();
  const [c] = await db.select({ id: schema.clients.id }).from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
  return c.id;
}
export async function saveClientOverview(clientId: number, layout: unknown) {
  const user = await requireUser();
  await setSetting(user.id, clientOverviewKey(await ownClientId(user.id, clientId)), layoutSchema.parse(layout));
}
export async function resetClientOverview(clientId: number) {
  const user = await requireUser();
  await deleteSetting(user.id, clientOverviewKey(await ownClientId(user.id, clientId)));
}

/** The agency's starting layout for a client's dashboard (what the client sees until they rearrange it). */
export async function saveClientBoard(clientId: number, layout: unknown) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(schema.clients)
    .set({ dashboardLayout: layoutSchema.parse(layout) })
    .where(and(eq(schema.clients.id, z.number().int().positive().parse(clientId)), eq(schema.clients.userId, user.id)));
}
export async function resetClientBoard(clientId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(schema.clients)
    .set({ dashboardLayout: null })
    .where(and(eq(schema.clients.id, z.number().int().positive().parse(clientId)), eq(schema.clients.userId, user.id)));
}
