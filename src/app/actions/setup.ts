"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { LIMITS, parsePageDraft } from "@/lib/custom-pages";
import { createPage } from "@/lib/custom-pages-db";
import { isModule } from "@/lib/modules";
import { saveSettings } from "@/lib/settings";
import { setModules } from "@/lib/users";

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
