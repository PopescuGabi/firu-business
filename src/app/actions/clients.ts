"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import type { DriveFile, Slide } from "@/lib/db/schema";
import { DEFAULT_THEME } from "@/lib/carousel-theme";
import { carouselProposal, reelProposal } from "@/lib/ai/editor";
import { getFileMeta } from "@/lib/google/drive";

const name = z.string().trim().min(1).max(200);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#007AFF");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null);
const newId = () => crypto.randomUUID().slice(0, 8);

async function deleteItemFeedback(targetType: string, targetId: number) {
  const db = await getDb();
  await db
    .delete(schema.clientFeedback)
    .where(and(eq(schema.clientFeedback.targetType, targetType), eq(schema.clientFeedback.targetId, targetId)));
}

/** A deleted reel or carousel takes its Claude chat and client feedback with it. */
async function deleteItemExtras(targetType: "reel" | "carousel", targetId: number) {
  const db = await getDb();
  await db.delete(schema.aiMessages).where(and(eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)));
  await deleteItemFeedback(targetType, targetId);
}

const clientFromForm = (fd: FormData) => ({
  name: name.parse(fd.get("name")),
  description: String(fd.get("description") ?? "").slice(0, 1000),
  appName: String(fd.get("appName") ?? "").slice(0, 200),
  color: color.parse(fd.get("color")),
});

// ── Clients ────────────────────────────────────────────────
export async function createClient(fd: FormData) {
  await requireUser();
  const db = await getDb();
  const [c] = await db.insert(schema.clients).values(clientFromForm(fd)).returning();
  revalidatePath("/", "layout");
  redirect(`/clients/${c.id}`);
}

export async function updateClient(id: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.clients).set(clientFromForm(fd)).where(eq(schema.clients.id, id));
  revalidatePath("/", "layout");
}

export async function setClientArchived(id: number, archived: boolean) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.clients).set({ archived }).where(eq(schema.clients.id, id));
  revalidatePath("/", "layout");
  if (archived) redirect("/clients");
}

// ── App updates ────────────────────────────────────────────
const updateInput = z.object({
  version: z.string().max(50).default(""),
  title: name,
  notes: z.string().max(20_000).default(""),
  status: z.enum(["planned", "in_progress", "shipped"]).catch("planned"),
  date,
});
const updateFromForm = (fd: FormData) =>
  updateInput.parse({
    version: fd.get("version") ?? "",
    title: fd.get("title"),
    notes: fd.get("notes") ?? "",
    status: fd.get("status"),
    date: fd.get("date") || null,
  });

export async function createAppUpdate(clientId: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  await db.insert(schema.appUpdates).values({ clientId, ...updateFromForm(fd) });
  revalidatePath(`/clients/${clientId}`);
}

export async function editAppUpdate(id: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  const [u] = await db
    .update(schema.appUpdates)
    .set({ ...updateFromForm(fd), updatedAt: new Date() })
    .where(eq(schema.appUpdates.id, id))
    .returning();
  revalidatePath(`/clients/${u.clientId}`);
}

export async function deleteAppUpdate(id: number) {
  await requireUser();
  const db = await getDb();
  const [u] = await db.delete(schema.appUpdates).where(eq(schema.appUpdates.id, id)).returning();
  await deleteItemFeedback("appUpdate", id);
  if (u) revalidatePath(`/clients/${u.clientId}`);
}

// ── Reels ──────────────────────────────────────────────────
export async function createReel(clientId: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  const [r] = await db
    .insert(schema.reels)
    .values({ clientId, title: name.parse(fd.get("title")), postDate: date.parse(fd.get("postDate") || null) })
    .returning();
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/reels/${r.id}`);
}

const reelPatch = z.object({
  title: name.optional(),
  status: z.enum(["idea", "scripting", "filming", "editing", "review", "posted"]).optional(),
  hook: z.string().max(5000).optional(),
  script: z.string().max(50_000).optional(),
  caption: z.string().max(5000).optional(),
  notes: z.string().max(50_000).optional(),
  postDate: date.optional(),
});

export async function saveReel(id: number, patch: z.input<typeof reelPatch>) {
  await requireUser();
  const db = await getDb();
  const [r] = await db
    .update(schema.reels)
    .set({ ...reelPatch.parse(patch), updatedAt: new Date() })
    .where(eq(schema.reels.id, id))
    .returning();
  revalidatePath(`/clients/${r.clientId}`);
  return r;
}

export async function deleteReel(id: number) {
  await requireUser();
  const db = await getDb();
  const [r] = await db.delete(schema.reels).where(eq(schema.reels.id, id)).returning();
  await deleteItemExtras("reel", id);
  redirect(`/clients/${r.clientId}?tab=reels`);
}

// ── Carousels ──────────────────────────────────────────────
export async function createCarousel(clientId: number, fd: FormData) {
  await requireUser();
  const db = await getDb();
  const [c] = await db
    .insert(schema.carousels)
    .values({
      clientId,
      title: name.parse(fd.get("title")),
      theme: DEFAULT_THEME,
      slides: [{ id: newId(), heading: "", body: "", note: "" }],
    })
    .returning();
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}/carousels/${c.id}`);
}

const slide = z.object({ id: z.string().max(40), heading: z.string().max(2000), body: z.string().max(10_000), note: z.string().max(5000) });
const carouselPatch = z.object({
  title: name.optional(),
  status: z.enum(["draft", "review", "approved", "posted"]).optional(),
  caption: z.string().max(5000).optional(),
  postDate: date.optional(),
  slides: z.array(slide).max(20).optional(),
  theme: z
    .object({
      background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      font: z.enum(["sans", "serif", "rounded"]),
      align: z.enum(["left", "center"]),
    })
    .optional(),
});

export async function saveCarousel(id: number, patch: z.input<typeof carouselPatch>) {
  await requireUser();
  const db = await getDb();
  const [c] = await db
    .update(schema.carousels)
    .set({ ...carouselPatch.parse(patch), updatedAt: new Date() })
    .where(eq(schema.carousels.id, id))
    .returning();
  revalidatePath(`/clients/${c.clientId}`);
  return c;
}

export async function deleteCarousel(id: number) {
  await requireUser();
  const db = await getDb();
  const [c] = await db.delete(schema.carousels).where(eq(schema.carousels.id, id)).returning();
  await deleteItemExtras("carousel", id);
  redirect(`/clients/${c.clientId}?tab=carousels`);
}

// ── Claude proposals ───────────────────────────────────────
export async function applyProposal(messageId: number) {
  await requireUser();
  const db = await getDb();
  const [m] = await db.select().from(schema.aiMessages).where(eq(schema.aiMessages.id, messageId));
  if (!m?.proposal) throw new Error("Nothing to apply");

  let result;
  if (m.targetType === "reel") {
    const { summary: _s, ...fields } = reelProposal.parse(m.proposal);
    result = await saveReel(m.targetId, fields);
  } else {
    const p = carouselProposal.parse(m.proposal);
    const [current] = await db.select().from(schema.carousels).where(eq(schema.carousels.id, m.targetId));
    const slides: Slide[] | undefined = p.slides?.map((s, i) => ({
      id: current.slides[i]?.id ?? newId(),
      heading: s.heading,
      body: s.body,
      note: s.note ?? "",
    }));
    result = await saveCarousel(m.targetId, {
      title: p.title,
      caption: p.caption,
      slides,
      theme: p.theme ? { ...current.theme, ...p.theme } : undefined,
    });
  }
  await db.update(schema.aiMessages).set({ applied: true }).where(eq(schema.aiMessages.id, messageId));
  return result;
}

export async function clearChat(targetType: "reel" | "carousel", targetId: number) {
  await requireUser();
  const db = await getDb();
  await db
    .delete(schema.aiMessages)
    .where(and(eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)));
}

// ── Drive files ────────────────────────────────────────────
type FileTarget = "appUpdate" | "reel" | "carousel";
const tableFor = (t: FileTarget) =>
  t === "appUpdate" ? schema.appUpdates : t === "reel" ? schema.reels : schema.carousels;

export async function attachFile(target: FileTarget, id: number, fileId: string) {
  await requireUser();
  if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error("Invalid file id");
  const meta = await getFileMeta(fileId);
  const file: DriveFile = {
    id: meta.id,
    name: meta.name,
    mimeType: meta.mimeType,
    webViewLink: meta.webViewLink,
    thumbnailLink: meta.thumbnailLink,
  };
  const db = await getDb();
  const table = tableFor(target);
  const [row] = await db.select().from(table).where(eq(table.id, id));
  if (!row) throw new Error("Not found");
  const files = [...row.files.filter((f) => f.id !== file.id), file];
  await db.update(table).set({ files }).where(eq(table.id, id));
  revalidatePath(`/clients/${row.clientId}`, "layout");
  return files;
}

/** Removes the link only; the file stays in your Google Drive. */
export async function detachFile(target: FileTarget, id: number, fileId: string) {
  await requireUser();
  const db = await getDb();
  const table = tableFor(target);
  const [row] = await db.select().from(table).where(eq(table.id, id));
  if (!row) return [];
  const files = row.files.filter((f) => f.id !== fileId);
  await db.update(table).set({ files }).where(eq(table.id, id));
  revalidatePath(`/clients/${row.clientId}`, "layout");
  return files;
}

export async function createClientFolder(clientId: number) {
  await requireUser();
  const { ensureClientFolder, folderUrl } = await import("@/lib/google/drive");
  const id = await ensureClientFolder(clientId);
  revalidatePath(`/clients/${clientId}`);
  return folderUrl(id);
}

// ── Quick add (Home): the client comes from the form ────────
const clientIdFrom = (fd: FormData) => z.coerce.number().int().positive().parse(fd.get("clientId"));

export async function quickAddReel(fd: FormData) {
  await createReel(clientIdFrom(fd), fd);
}

export async function quickAddCarousel(fd: FormData) {
  await createCarousel(clientIdFrom(fd), fd);
}

export async function quickAddAppUpdate(fd: FormData) {
  const clientId = clientIdFrom(fd);
  await createAppUpdate(clientId, fd);
  redirect(`/clients/${clientId}?tab=app`);
}
