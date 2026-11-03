import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { requestSync } from "./calendar-sync";
import { getDb, type Db } from "./db";

/** A schedule change from a server action: sign-in check, the change, then refresh every page and sync the calendar. */
export async function mutateSchedule(change: (db: Db) => Promise<unknown>) {
  await requireUser();
  await change(await getDb());
  revalidatePath("/", "layout");
  requestSync();
}
