"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { LEAD_STATUSES } from "@/lib/db/schema";
import { leadsFromCsv } from "@/lib/leads";

export type ImportState = { ok: boolean; message: string } | null;

/** Upsert leads from the Business Brain's leads.csv, matched by business name. A status set here is kept unless the file moved further. */
export async function importLeads(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose your leads.csv first." };
  if (file.size > 2_000_000) return { ok: false, message: "That file is over 2 MB; leads.csv is usually a few kilobytes." };
  let rows;
  try {
    rows = leadsFromCsv(await file.text());
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (rows.length === 0) return { ok: false, message: "No leads found in that file." };
  const db = await getDb();
  const rank = (s: string) => LEAD_STATUSES.indexOf(s as (typeof LEAD_STATUSES)[number]);
  const existing = await db.select().from(schema.leads).where(eq(schema.leads.userId, user.id));
  let added = 0;
  let updated = 0;
  for (const r of rows) {
    const prev = existing.find((e) => e.business.toLowerCase() === r.business.toLowerCase());
    if (!prev) {
      await db.insert(schema.leads).values({ ...r, userId: user.id });
      added++;
    } else {
      const status = rank(r.status) > rank(prev.status) ? r.status : prev.status;
      await db
        .update(schema.leads)
        .set({ ...r, business: prev.business, status, demoUrl: r.demoUrl ?? prev.demoUrl, updatedAt: sql`now()` })
        .where(eq(schema.leads.id, prev.id));
      updated++;
    }
  }
  revalidatePath("/analysis");
  revalidatePath("/");
  return { ok: true, message: `${added} new, ${updated} updated.` };
}

const statusInput = z.object({ id: z.number().int().positive(), status: z.enum(LEAD_STATUSES) });

export async function setLeadStatus(id: number, status: string) {
  const user = await requireUser();
  const v = statusInput.parse({ id, status });
  const db = await getDb();
  await db
    .update(schema.leads)
    .set({ status: v.status, updatedAt: sql`now()` })
    .where(and(eq(schema.leads.id, v.id), eq(schema.leads.userId, user.id)));
  revalidatePath("/analysis");
  revalidatePath("/");
}
