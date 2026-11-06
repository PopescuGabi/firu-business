"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import type { DriveFile, Slide } from "@/lib/db/schema";
import { DEFAULT_THEME } from "@/lib/carousel-theme";
import { BUSINESS_TYPES, isClientTool } from "@/lib/client-tools";
import { carouselProposal, reelProposal } from "@/lib/ai/editor";
import { getFileMeta } from "@/lib/google/drive";
import { parsePageDraft } from "@/lib/custom-pages";
import { clientProfile, reelPlan } from "@/lib/reels-brain/types";
import { videoSpec } from "@/lib/video/spec";

const name = z.string().trim().min(1).max(200);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).catch("#007AFF");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null);
const newId = () => crypto.randomUUID().slice(0, 8);

async function deleteItemFeedback(uid: number, targetType: string, targetId: number) {
  const db = await getDb();
  await db
    .delete(schema.clientFeedback)
    .where(
      and(
        eq(schema.clientFeedback.userId, uid),
        eq(schema.clientFeedback.targetType, targetType),
        eq(schema.clientFeedback.targetId, targetId),
      ),
    );
}

/** A deleted reel or carousel takes its Claude chat and client feedback with it. */
async function deleteItemExtras(uid: number, targetType: "reel" | "carousel", targetId: number) {
  const db = await getDb();
  await db
    .delete(schema.aiMessages)
    .where(and(eq(schema.aiMessages.userId, uid), eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)));
  await deleteItemFeedback(uid, targetType, targetId);
}

/** New items can only go under one of your own clients. */
async function assertOwnClient(uid: number, clientId: number) {
  const db = await getDb();
  const [c] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
}

const clientFromForm = (fd: FormData) => {
  const features = [...new Set(fd.getAll("features").map(String).filter(isClientTool))];
  return {
    name: name.parse(fd.get("name")),
    description: String(fd.get("description") ?? "").slice(0, 1000),
    // The app name only matters with the app tool.
    appName: features.includes("app") ? String(fd.get("appName") ?? "").slice(0, 200) : "",
    color: color.parse(fd.get("color")),
    businessType: BUSINESS_TYPES.some((t) => t.key === fd.get("businessType")) ? String(fd.get("businessType")) : "",
    features,
  };
};

// ── Clients ────────────────────────────────────────────────
export async function createClient(fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  const [c] = await db.insert(schema.clients).values({ userId: user.id, ...clientFromForm(fd) }).returning();
  revalidatePath("/", "layout");
  redirect(`/clients/${c.id}`);
}

export async function updateClient(id: number, fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.clients).set(clientFromForm(fd)).where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function setClientArchived(id: number, archived: boolean) {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.clients).set({ archived }).where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)));
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
  const user = await requireUser();
  await assertOwnClient(user.id, clientId);
  const db = await getDb();
  await db.insert(schema.appUpdates).values({ userId: user.id, clientId, ...updateFromForm(fd) });
  revalidatePath(`/clients/${clientId}`);
}

export async function editAppUpdate(id: number, fd: FormData) {
  const user = await requireUser();
  const db = await getDb();
  const [u] = await db
    .update(schema.appUpdates)
    .set({ ...updateFromForm(fd), updatedAt: new Date() })
    .where(and(eq(schema.appUpdates.id, id), eq(schema.appUpdates.userId, user.id)))
    .returning();
  if (!u) throw new Error("Not found");
  revalidatePath(`/clients/${u.clientId}`);
}

export async function deleteAppUpdate(id: number) {
  const user = await requireUser();
  const db = await getDb();
  const [u] = await db
    .delete(schema.appUpdates)
    .where(and(eq(schema.appUpdates.id, id), eq(schema.appUpdates.userId, user.id)))
    .returning();
  await deleteItemFeedback(user.id, "appUpdate", id);
  if (u) revalidatePath(`/clients/${u.clientId}`);
}

// ── Reels ──────────────────────────────────────────────────
export async function createReel(clientId: number, fd: FormData) {
  const user = await requireUser();
  await assertOwnClient(user.id, clientId);
  const db = await getDb();
  const [r] = await db
    .insert(schema.reels)
    .values({ userId: user.id, clientId, title: name.parse(fd.get("title")), postDate: date.parse(fd.get("postDate") || null) })
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
  const user = await requireUser();
  const db = await getDb();
  const [r] = await db
    .update(schema.reels)
    .set({ ...reelPatch.parse(patch), updatedAt: new Date() })
    .where(and(eq(schema.reels.id, id), eq(schema.reels.userId, user.id)))
    .returning();
  if (!r) throw new Error("Not found");
  revalidatePath(`/clients/${r.clientId}`);
  return r;
}

export async function deleteReel(id: number) {
  const user = await requireUser();
  const db = await getDb();
  const [r] = await db
    .delete(schema.reels)
    .where(and(eq(schema.reels.id, id), eq(schema.reels.userId, user.id)))
    .returning();
  if (!r) throw new Error("Not found");
  await deleteItemExtras(user.id, "reel", id);
  redirect(`/clients/${r.clientId}?tab=content`);
}

// ── Carousels ──────────────────────────────────────────────
export async function createCarousel(clientId: number, fd: FormData) {
  const user = await requireUser();
  await assertOwnClient(user.id, clientId);
  const db = await getDb();
  const [c] = await db
    .insert(schema.carousels)
    .values({
      userId: user.id,
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
  const user = await requireUser();
  const db = await getDb();
  const [c] = await db
    .update(schema.carousels)
    .set({ ...carouselPatch.parse(patch), updatedAt: new Date() })
    .where(and(eq(schema.carousels.id, id), eq(schema.carousels.userId, user.id)))
    .returning();
  if (!c) throw new Error("Not found");
  revalidatePath(`/clients/${c.clientId}`);
  return c;
}

export async function deleteCarousel(id: number) {
  const user = await requireUser();
  const db = await getDb();
  const [c] = await db
    .delete(schema.carousels)
    .where(and(eq(schema.carousels.id, id), eq(schema.carousels.userId, user.id)))
    .returning();
  if (!c) throw new Error("Not found");
  await deleteItemExtras(user.id, "carousel", id);
  redirect(`/clients/${c.clientId}?tab=content`);
}

// ── Claude proposals ───────────────────────────────────────
export async function applyProposal(messageId: number) {
  const user = await requireUser();
  const db = await getDb();
  const [m] = await db
    .select()
    .from(schema.aiMessages)
    .where(and(eq(schema.aiMessages.id, messageId), eq(schema.aiMessages.userId, user.id)));
  if (!m?.proposal) throw new Error("Nothing to apply");

  let result;
  if (m.targetType === "page") {
    // A custom page's new layout from "Edit with AI": checked again, then saved. Entries are never deleted.
    const { draft } = parsePageDraft(m.proposal);
    if (!draft) throw new Error("This layout can't be applied");
    await db
      .update(schema.customPages)
      .set({ title: draft.title, icon: draft.icon, color: draft.color, description: draft.description, spec: draft.spec, updatedAt: new Date() })
      .where(and(eq(schema.customPages.id, m.targetId), eq(schema.customPages.userId, user.id)));
    revalidatePath("/", "layout");
    result = null;
  } else if (m.targetType === "reel") {
    const { summary: _s, ...fields } = reelProposal.parse(m.proposal);
    result = await saveReel(m.targetId, fields);
  } else {
    const p = carouselProposal.parse(m.proposal);
    const [current] = await db
      .select()
      .from(schema.carousels)
      .where(and(eq(schema.carousels.id, m.targetId), eq(schema.carousels.userId, user.id)));
    if (!current) throw new Error("Not found");
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
  await db
    .update(schema.aiMessages)
    .set({ applied: true })
    .where(and(eq(schema.aiMessages.id, messageId), eq(schema.aiMessages.userId, user.id)));
  return result;
}

export async function clearChat(targetType: "reel" | "carousel" | "page", targetId: number) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .delete(schema.aiMessages)
    .where(and(eq(schema.aiMessages.userId, user.id), eq(schema.aiMessages.targetType, targetType), eq(schema.aiMessages.targetId, targetId)));
}

// ── Drive files ────────────────────────────────────────────
type FileTarget = "appUpdate" | "reel" | "carousel";
const tableFor = (t: FileTarget) =>
  t === "appUpdate" ? schema.appUpdates : t === "reel" ? schema.reels : schema.carousels;

export async function attachFile(target: FileTarget, id: number, fileId: string) {
  const user = await requireUser();
  if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error("Invalid file id");
  const meta = await getFileMeta(user.id, fileId);
  const file: DriveFile = {
    id: meta.id,
    name: meta.name,
    mimeType: meta.mimeType,
    webViewLink: meta.webViewLink,
    thumbnailLink: meta.thumbnailLink,
  };
  const db = await getDb();
  const table = tableFor(target);
  const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.userId, user.id)));
  if (!row) throw new Error("Not found");
  const files = [...row.files.filter((f) => f.id !== file.id), file];
  await db.update(table).set({ files }).where(and(eq(table.id, id), eq(table.userId, user.id)));
  revalidatePath(`/clients/${row.clientId}`, "layout");
  return files;
}

/** Removes the link only; the file stays in your Google Drive. */
export async function detachFile(target: FileTarget, id: number, fileId: string) {
  const user = await requireUser();
  const db = await getDb();
  const table = tableFor(target);
  const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.userId, user.id)));
  if (!row) return [];
  const files = row.files.filter((f) => f.id !== fileId);
  await db.update(table).set({ files }).where(and(eq(table.id, id), eq(table.userId, user.id)));
  revalidatePath(`/clients/${row.clientId}`, "layout");
  return files;
}

export async function createClientFolder(clientId: number) {
  const user = await requireUser();
  const { ensureClientFolder, folderUrl } = await import("@/lib/google/drive");
  const id = await ensureClientFolder(user.id, clientId);
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

// ── Reels Brain ────────────────────────────────────────────
/** Saves a client's Reels Brain profile (who the content is for). */
export async function saveClientProfile(id: number, profile: unknown) {
  const user = await requireUser();
  const db = await getDb();
  const clean = clientProfile.parse(profile);
  const [c] = await db
    .update(schema.clients)
    .set({ profile: clean })
    .where(and(eq(schema.clients.id, id), eq(schema.clients.userId, user.id)))
    .returning({ id: schema.clients.id });
  if (!c) throw new Error("Not found");
  revalidatePath(`/clients/${id}`);
  return clean;
}

/** Saves a reel's plan (diagnosis, caption plan, experiment, review checks). */
export async function saveReelPlan(id: number, plan: unknown) {
  const user = await requireUser();
  const db = await getDb();
  const clean = reelPlan.parse(plan);
  const [r] = await db
    .update(schema.reels)
    .set({ plan: clean, updatedAt: new Date() })
    .where(and(eq(schema.reels.id, id), eq(schema.reels.userId, user.id)))
    .returning({ id: schema.reels.id });
  if (!r) throw new Error("Not found");
  return clean;
}

/** Saves the AI video maker's brief and spec for a reel (the spec is re-validated; attachments stay in the browser). */
export async function saveReelVideo(id: number, video: { brief?: string; spec?: unknown }) {
  const user = await requireUser();
  const db = await getDb();
  const clean = {
    brief: z.string().max(8000).catch("").parse(video.brief ?? ""),
    spec: video.spec === undefined ? undefined : videoSpec.parse(video.spec),
  };
  const [r] = await db
    .update(schema.reels)
    .set({ video: clean, updatedAt: new Date() })
    .where(and(eq(schema.reels.id, id), eq(schema.reels.userId, user.id)))
    .returning({ id: schema.reels.id });
  if (!r) throw new Error("Not found");
  return clean;
}
