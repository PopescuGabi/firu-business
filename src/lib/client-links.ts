import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";

/** What an agency can share with a client's own account (never finance: that's the agency's business). */
export const SHAREABLE = [
  { key: "instagram", label: "Instagram analytics", description: "Their Instagram dashboard." },
  { key: "content", label: "Content", description: "Reels and carousels ready for review or posted." },
  { key: "app", label: "App updates", description: "Versions and what changed." },
] as const;
export type Shareable = (typeof SHAREABLE)[number]["key"];
export const shareableFor = (features: readonly string[]) => SHAREABLE.filter((s) => features.includes(s.key)).map((s) => s.key);

/**
 * Called at sign-in: turns client invitations for this email into links, so the person sees
 * "From <agency>" in their own hub. Shares every shareable tool the client has, by default.
 */
export async function acceptClientInvites(user: { id: number; email: string }) {
  const db = await getDb();
  // scoped: invitations are looked up by the invited person's own email.
  const pending = await db.select().from(schema.clientInvites).where(eq(schema.clientInvites.email, user.email));
  for (const inv of pending) {
    if (inv.userId === user.id) continue; // can't be your own client
    const [client] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, inv.clientId), eq(schema.clients.userId, inv.userId)));
    if (client) {
      await db
        .insert(schema.clientLinks)
        .values({ userId: inv.userId, clientId: client.id, clientUserId: user.id, shared: shareableFor(client.features) })
        .onConflictDoUpdate({ target: schema.clientLinks.clientId, set: { clientUserId: user.id } });
    }
    await db.delete(schema.clientInvites).where(and(eq(schema.clientInvites.id, inv.id), eq(schema.clientInvites.userId, inv.userId)));
  }
}

export type ViewerLink = {
  id: number;
  agencyId: number;
  agencyName: string;
  clientId: number;
  clientName: string;
  color: string;
  features: string[];
  shared: string[];
};

/** Every business that shares a dashboard with this person (they are that business's contact). */
export async function linksForViewer(uid: number): Promise<ViewerLink[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.clientLinks.id,
      agencyId: schema.clientLinks.userId,
      agencyName: schema.users.name,
      agencyEmail: schema.users.email,
      clientId: schema.clients.id,
      clientName: schema.clients.name,
      color: schema.clients.color,
      features: schema.clients.features,
      archived: schema.clients.archived,
      shared: schema.clientLinks.shared,
    })
    .from(schema.clientLinks)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.clientLinks.clientId))
    .innerJoin(schema.users, eq(schema.users.id, schema.clientLinks.userId))
    .where(eq(schema.clientLinks.clientUserId, uid));
  // The agency's name as on their Home greeting (Settings), else their Google first name.
  const agencyIds = [...new Set(rows.map((r) => r.agencyId))];
  const names = agencyIds.length
    ? await db
        .select({ userId: schema.settings.userId, value: schema.settings.value })
        .from(schema.settings)
        .where(and(inArray(schema.settings.userId, agencyIds), eq(schema.settings.key, "displayName")))
    : [];
  const nameOf = (r: (typeof rows)[number]) => {
    const v = names.find((n) => n.userId === r.agencyId)?.value;
    return (typeof v === "string" && v.trim()) || (r.agencyName ?? "").split(" ")[0] || r.agencyEmail.split("@")[0];
  };
  return rows
    .filter((r) => !r.archived)
    .map((r) => ({
      id: r.id,
      agencyId: r.agencyId,
      agencyName: nameOf(r),
      clientId: r.clientId,
      clientName: r.clientName,
      color: r.color,
      features: r.features,
      // Only what the client still has as a tool.
      shared: r.shared.filter((s) => r.features.includes(s)),
    }));
}

/** The guard for /shared pages: this link, only if it belongs to the viewer. */
export async function linkFor(uid: number, linkId: number): Promise<ViewerLink | null> {
  return (await linksForViewer(uid)).find((l) => l.id === linkId) ?? null;
}

/** Agency side: who (if anyone) this client's dashboard is shared with, and any pending invitation. */
export async function clientAccess(agencyUid: number, clientId: number) {
  const db = await getDb();
  const [[link], [invite]] = await Promise.all([
    db
      .select({ id: schema.clientLinks.id, shared: schema.clientLinks.shared, clientUserId: schema.clientLinks.clientUserId, email: schema.users.email, name: schema.users.name })
      .from(schema.clientLinks)
      .innerJoin(schema.users, eq(schema.users.id, schema.clientLinks.clientUserId))
      .where(and(eq(schema.clientLinks.userId, agencyUid), eq(schema.clientLinks.clientId, clientId))),
    db.select().from(schema.clientInvites).where(and(eq(schema.clientInvites.userId, agencyUid), eq(schema.clientInvites.clientId, clientId))),
  ]);
  return { link: link ?? null, invite: invite ?? null };
}
