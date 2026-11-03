import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { requestSync } from "./calendar-sync";
import { getDb, type Db } from "./db";

/**
 * A schedule change from a server action: sign-in check, the change (scoped to `uid`), then refresh every page
 * and sync that person's calendar.
 */
export async function mutateSchedule(change: (db: Db, uid: number) => Promise<unknown>) {
  const user = await requireUser();
  await change(await getDb(), user.id);
  revalidatePath("/", "layout");
  requestSync(user.id);
}
