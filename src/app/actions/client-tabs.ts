"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { featuresForTabs, pageTabKey, tabsFor } from "@/lib/client-tabs";
import { parsePageDraft } from "@/lib/custom-pages";
import { clientPages, createPage } from "@/lib/custom-pages-db";
import { getDb, schema } from "@/lib/db";
import { templateFor } from "@/lib/page-templates";
import { TAB_STARTERS as STARTERS } from "@/lib/tab-starters";

const id = z.number().int().positive();

async function ownClient(uid: number, clientId: number) {
  const db = await getDb();
  const [c] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, id.parse(clientId)), eq(schema.clients.userId, uid)));
  if (!c) throw new Error("Client not found");
  return c;
}

/** Saves a client's tab list (order and which are on). Tool tabs switch that tool on or off for the client too. */
export async function setClientTabs(clientId: number, keys: string[]) {
  const user = await requireUser();
  const client = await ownClient(user.id, clientId);
  const list = z.array(z.string().max(40)).max(40).parse(keys);
  const pages = await clientPages(user.id, client.id);
  const features = featuresForTabs(list, client.features);
  const tabs = tabsFor(list, features, pages.map((p) => p.id));
  const db = await getDb();
  await db.update(schema.clients).set({ tabs, features }).where(and(eq(schema.clients.id, client.id), eq(schema.clients.userId, user.id)));
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/clients");
}

async function addPageTab(uid: number, clientId: number, raw: unknown) {
  const client = await ownClient(uid, clientId);
  const { draft, problems } = parsePageDraft(raw);
  if (!draft) return { ok: false as const, message: problems[0] ?? "That tab isn't complete yet." };
  const page = await createPage(uid, draft, client.id);
  const pages = await clientPages(uid, client.id);
  const current = tabsFor(client.tabs, client.features, pages.map((p) => p.id));
  const tabs = [...current.filter((k) => k !== pageTabKey(page.id)), pageTabKey(page.id)];
  const db = await getDb();
  await db.update(schema.clients).set({ tabs }).where(and(eq(schema.clients.id, client.id), eq(schema.clients.userId, uid)));
  revalidatePath(`/clients/${client.id}`);
  return { ok: true as const, href: `/clients/${client.id}?tab=${pageTabKey(page.id)}` };
}

/** Adds an own tab from a starter (notes, links, checklist, tracker) or a ready-made template ("creative:0"). */
export async function addClientStarterTab(clientId: number, key: string) {
  const user = await requireUser();
  const k = z.string().max(30).parse(key);
  const raw = STARTERS[k] ?? (/^[a-z]+:\d{1,2}$/.test(k) ? templateFor(k) : null);
  if (!raw) return { ok: false as const, message: "Unknown starting point." };
  return addPageTab(user.id, clientId, raw).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Couldn't add the tab." }));
}

/** An own tab built by hand in the page builder; checked with the same rules as every page. */
export async function addClientBuiltTab(clientId: number, raw: unknown) {
  const user = await requireUser();
  return addPageTab(user.id, clientId, raw).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Couldn't add the tab." }));
}
