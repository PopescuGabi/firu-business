import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import type { ModuleKey } from "./modules";

/** For a section's pages: the user, or off to Settings → Sections when they haven't turned it on. */
export async function requireModule(key: ModuleKey) {
  const user = await requireUser();
  if (!user.modules.includes(key)) redirect(`/settings?section=${key}#sections`);
  return user;
}
