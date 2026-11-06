"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { LIMITS, parsePageDraft } from "@/lib/custom-pages";
import { createPage } from "@/lib/custom-pages-db";
import { isModule } from "@/lib/modules";
import { saveSettings } from "@/lib/settings";
import { setModules } from "@/lib/users";
import { templateFor } from "@/lib/page-templates";

const input = z.object({
  modules: z.array(z.string()).max(10),
  pages: z.array(z.unknown()).max(LIMITS.pagesPerSetup),
  displayName: z.string().trim().max(40).optional(),
  timezone: z.string().max(60).optional(),
});

/**
 * Saves the AI setup the person confirmed: the sections they kept on and the pages they kept. Every page is
 * validated again here (the browser only sends back what the AI proposed). Existing pages are never touched.
 */
export async function applySetup(raw: z.input<typeof input>) {
  const user = await requireUser();
  const v = input.parse(raw);
  const created: string[] = [];
  for (const p of v.pages) {
    const { draft } = parsePageDraft(p);
    if (draft) created.push((await createPage(user.id, draft)).slug);
  }
  await setModules(user.id, v.modules.filter(isModule), true);
  const patch: { displayName?: string; timezone?: string } = {};
  if (v.displayName !== undefined) patch.displayName = v.displayName;
  if (v.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone });
      patch.timezone = v.timezone;
    } catch {
      // keep the current zone
    }
  }
  if (Object.keys(patch).length) await saveSettings(user.id, patch);
  revalidatePath("/", "layout");
  return { href: created.length ? `/p/${created[0]}` : "/" };
}

/** Adds ready-made pages (by template key, e.g. "creative:0"). The page content comes from the server's templates only. */
export async function addTemplatePages(keys: string[]) {
  const user = await requireUser();
  const list = z.array(z.string().regex(/^[a-z]+:\d{1,2}$/)).min(1).max(12).parse(keys);
  const created: string[] = [];
  for (const key of [...new Set(list)]) {
    const { draft } = parsePageDraft(templateFor(key));
    if (draft) created.push((await createPage(user.id, draft)).slug);
  }
  revalidatePath("/", "layout");
  return { added: created.length, href: created.length ? `/p/${created[0]}` : null };
}

/** A page built by hand in the page builder; checked with the same rules as AI pages. */
export async function createCustomPage(raw: unknown) {
  const user = await requireUser();
  const { draft, problems } = parsePageDraft(raw);
  if (!draft) return { ok: false as const, message: problems[0] ?? "That page isn't complete yet." };
  const page = await createPage(user.id, draft);
  revalidatePath("/", "layout");
  return { ok: true as const, href: `/p/${page.slug}` };
}
