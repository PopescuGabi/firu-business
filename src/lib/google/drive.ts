import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { googleFetch } from "./oauth";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
export const DRIVE_ROOT_NAME = "Personal Hub";

async function createFolder(name: string, parent?: string) {
  const res = await googleFetch(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }),
  });
  return ((await res.json()) as { id: string }).id;
}

async function findFolder(name: string, parent: string) {
  const q = `name = '${name.replace(/['\\]/g, "\\$&")}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`;
  const res = await googleFetch(`${API}/files?fields=files(id)&q=${encodeURIComponent(q)}`);
  return ((await res.json()) as { files: { id: string }[] }).files[0]?.id ?? null;
}

async function folderExists(id: string) {
  try {
    const res = await googleFetch(`${API}/files/${id}?fields=id,trashed`);
    return !((await res.json()) as { trashed?: boolean }).trashed;
  } catch {
    return false;
  }
}

export async function ensureRootFolder() {
  const db = await getDb();
  const [acc] = await db.select().from(schema.googleAccount).where(eq(schema.googleAccount.id, 1));
  if (acc?.rootFolderId && (await folderExists(acc.rootFolderId))) return acc.rootFolderId;
  const id = await createFolder(DRIVE_ROOT_NAME);
  await db.update(schema.googleAccount).set({ rootFolderId: id }).where(eq(schema.googleAccount.id, 1));
  return id;
}

export async function ensureClientFolder(clientId: number) {
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, clientId));
  if (!client) throw new Error("Client not found");
  if (client.driveFolderId && (await folderExists(client.driveFolderId))) return client.driveFolderId;
  const root = await ensureRootFolder();
  const id = (await findFolder(client.name, root)) ?? (await createFolder(client.name, root));
  await db.update(schema.clients).set({ driveFolderId: id }).where(eq(schema.clients.id, clientId));
  return id;
}

export type DriveSection = "App" | "Reels" | "Carousels";

export async function ensureSectionFolder(clientId: number, section: DriveSection) {
  const clientFolder = await ensureClientFolder(clientId);
  return (await findFolder(section, clientFolder)) ?? (await createFolder(section, clientFolder));
}

/**
 * Starts a resumable upload. The browser then sends the file straight to Google,
 * so large reel footage never passes through (or is limited by) this server.
 */
export async function startResumableUpload(opts: {
  name: string;
  mimeType: string;
  size: number;
  parentId: string;
  origin: string;
}) {
  const res = await googleFetch(
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

export async function getFileMeta(id: string) {
  const res = await googleFetch(`${API}/files/${id}?fields=id,name,mimeType,webViewLink,thumbnailLink,trashed`);
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
