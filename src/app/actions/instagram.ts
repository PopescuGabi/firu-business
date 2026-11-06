"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteAccount } from "@/lib/instagram/sync";

/** Disconnect: deletes the account and every post and day stored for it (Meta's terms: delete on disconnect). */
export async function disconnectInstagram(accountId: number) {
  const user = await requireUser();
  await deleteAccount(z.number().int().positive().parse(accountId), user.id);
  revalidatePath("/", "layout");
}
