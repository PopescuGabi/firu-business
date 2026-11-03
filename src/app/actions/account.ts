"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner, requireUser } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { revokeGoogle } from "@/lib/google/oauth";
import { isModule } from "@/lib/modules";
import { saveSettings } from "@/lib/settings";
import { cancelInvite, deleteUser, invite, setAnthropicKey, setModules } from "@/lib/users";

export type FormState = { ok: boolean; message: string } | null;

// ── Members (owner) ───────────────────────────────────────────
export async function inviteMember(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireOwner();
  try {
    await invite(String(fd.get("email") ?? ""));
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't invite" };
  }
  revalidatePath("/settings");
  return { ok: true, message: "Invited. They can now sign in with that Google account." };
}

export async function withdrawInvite(email: string) {
  await requireOwner();
  await cancelInvite(email);
  revalidatePath("/settings");
}

/** Removes a member and everything they stored here (their Google files stay in their Google account). */
export async function removeMember(uid: number) {
  const owner = await requireOwner();
  if (uid === owner.id) throw new Error("You can't remove yourself.");
  await revokeGoogle(uid).catch(() => {});
  await deleteUser(uid);
  revalidatePath("/settings");
}

// ── Your account ─────────────────────────────────────────────
/** First sign-in (and Settings → Sections): which sections to show, plus name and time zone. */
export async function saveSections(fd: FormData) {
  const user = await requireUser();
  const modules = fd.getAll("modules").map(String).filter(isModule);
  await setModules(user.id, modules);
  const name = String(fd.get("displayName") ?? "").trim().slice(0, 40);
  const tz = String(fd.get("timezone") ?? "");
  const patch: { displayName?: string; timezone?: string } = {};
  if (fd.has("displayName")) patch.displayName = name;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      patch.timezone = tz;
    } catch {
      // keep the current zone
    }
  }
  if (Object.keys(patch).length) await saveSettings(user.id, patch);
  revalidatePath("/", "layout");
  if (fd.get("next") === "home") redirect("/");
}

export async function saveAnthropicKey(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (fd.get("remove") === "1") {
    await setAnthropicKey(user.id, null);
    revalidatePath("/", "layout");
    return { ok: true, message: "Removed. Claude app mode still works." };
  }
  const key = z.string().trim().regex(/^sk-ant-[\w-]{20,}$/, "That doesn't look like an Anthropic API key (sk-ant-…)").safeParse(fd.get("key"));
  if (!key.success) return { ok: false, message: key.error.issues[0].message };
  await setAnthropicKey(user.id, key.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Claude now works inside the site for you." };
}

/** Deletes your account and everything you stored here, and disconnects Google. */
export async function deleteMyAccount(fd: FormData) {
  const user = await requireUser();
  if (user.role === "owner") throw new Error("The owner account can't be deleted here.");
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== user.email) throw new Error("Type your email to confirm.");
  await revokeGoogle(user.id).catch(() => {});
  await deleteUser(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

