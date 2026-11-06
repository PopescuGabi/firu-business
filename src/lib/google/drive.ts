import "server-only";
import { and, eq } from "drizzle-orm";
import { APP_NAME, LEGACY_APP_NAME } from "../brand";
import { getDb, schema } from "../db";
import { googleFetch } from "./oauth";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
export const DRIVE_ROOT_NAME = APP_NAME;

async function createFolder(uid: number, name: string, parent?: string) {
  const res = await googleFetch(uid, `${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }),
  });
  return ((await res.json()) as { id: string }).id;
}

async function findFolder(uid: number, name: string, parent: string) {
  const q = `name = '${name.replace(/['\\]/g, "\\$&")}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`;
  const res = await googleFetch(uid, `${API}/files?fields=files(id)&q=${encodeURIComponent(q)}`);
  return ((await res.json()) as { files: { id: string }[] }).files[0]?.id ?? null;
}

async function folderExists(uid: number, id: string) {
  return (await folderInfo(uid, id)) !== null;
}

async function folderInfo(uid: number, id: string): Promise<{ name: string } | null> {
  try {
    const res = await googleFetch(uid, `${API}/files/${id}?fields=id,name,trashed`);
    const f = (await res.json()) as { name?: string; trashed?: boolean };
    return f.trashed ? null : { name: f.name ?? "" };
  } catch {
    return null;
  }
}

export async function ensureRootFolder(uid: number) {
  const db = await getDb();
  const [acc] = await db.select().from(schema.googleAccount).where(eq(schema.googleAccount.id, uid));
  const existing = acc?.rootFolderId ? await folderInfo(uid, acc.rootFolderId) : null;
  if (acc?.rootFolderId && existing) {
    // Made before the rename: give the folder the new name once (drive.file may rename files the app created).
    if (existing.name === LEGACY_APP_NAME) {
      await googleFetch(uid, `${API}/files/${acc.rootFolderId}?fields=id`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: DRIVE_ROOT_NAME }),
      }).catch(() => {}); // the old name is only cosmetic
    }
    return acc.rootFolderId;
  }
  const id = await createFolder(uid, DRIVE_ROOT_NAME);
  await db.update(schema.googleAccount).set({ rootFolderId: id }).where(eq(schema.googleAccount.id, uid));
  return id;
}

export async function ensureClientFolder(uid: number, clientId: number) {
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, uid)));
  if (!client) throw new Error("Client not found");
  if (client.driveFolderId && (await folderExists(uid, client.driveFolderId))) return client.driveFolderId;
  const root = await ensureRootFolder(uid);
  const id = (await findFolder(uid, client.name, root)) ?? (await createFolder(uid, client.name, root));
  await db.update(schema.clients).set({ driveFolderId: id }).where(and(eq(schema.clients.id, clientId), eq(schema.clients.userId, uid)));
  return id;
}

export type DriveSection = "App" | "Reels" | "Carousels";

export async function ensureSectionFolder(uid: number, clientId: number, section: DriveSection) {
  const clientFolder = await ensureClientFolder(uid, clientId);
  return (await findFolder(uid, section, clientFolder)) ?? (await createFolder(uid, section, clientFolder));
}

/** "FIRU Business/Portfolio": where portfolio uploads go. */
export async function ensurePortfolioFolder(uid: number) {
  const root = await ensureRootFolder(uid);
  return (await findFolder(uid, "Portfolio", root)) ?? (await createFolder(uid, "Portfolio", root));
}

/**
 * Turns "anyone with the link can view" on or off for a file the app created (drive.file allows this).
 * Used for portfolio items you mark public, so the share page can show them.
 */
export async function setLinkSharing(uid: number, id: string, on: boolean) {
  if (on) {
    await googleFetch(uid, `${API}/files/${id}/permissions?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
    });
  } else {
    await googleFetch(uid, `${API}/files/${id}/permissions/anyoneWithLink`, { method: "DELETE" }).catch((err) => {
      if (!String(err).includes("404")) throw err; // already private
    });
  }
}

/** A small preview image of a Drive file, fetched as you (for the private Portfolio tab). */
export async function fetchThumbnail(uid: number, id: string, size = 800) {
  const meta = (await (await googleFetch(uid, `${API}/files/${id}?fields=thumbnailLink`)).json()) as { thumbnailLink?: string };
  if (!meta.thumbnailLink) return null;
  const res = await googleFetch(uid, meta.thumbnailLink.replace(/=s\d+$/, `=s${size}`));
  return { body: res.body, type: res.headers.get("content-type") ?? "image/jpeg" };
}

/** Public preview addresses, which work once a file is shared with "anyone with the link". */
export const publicThumbUrl = (id: string, width = 1200) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;
export const publicPreviewUrl = (id: string) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;

/**
 * Starts a resumable upload. The browser then sends the file straight to Google,
 * so large reel footage never passes through (or is limited by) this server.
 */
export async function startResumableUpload(uid: number, opts: {
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  origin: string;
}) {
  const res = await googleFetch(uid, 
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,thumbnailLink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": opts.mimeType,
        "X-Upload-Content-Length": String(opts.size),
        Origin: opts.origin,
      },
      body: JSON.stringify({ name: opts.name, parents: [opts.parentId] }),
    },
  );
  const url = res.headers.get("location");
  if (!url) throw new Error("Google Drive did not return an upload URL");
  return url;
}

export async function getFileMeta(uid: number, id: string) {
  const res = await googleFetch(uid, `${API}/files/${id}?fields=id,name,mimeType,webViewLink,thumbnailLink,trashed`);
  return (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    thumbnailLink?: string;
    trashed?: boolean;
  };
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
