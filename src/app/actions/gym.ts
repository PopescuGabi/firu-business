"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

const setInput = z.object({
  exercise: z.string().trim().min(1).max(100),
  setNo: z.number().int().min(1).max(20),
  weight: z.number().min(0).max(1000).transform((kg) => Math.round(kg * 4) / 4),
  reps: z.number().int().min(1).max(100),
});

/** Tick a set as done (today, in your time zone). Ticking it again with new numbers updates it. */
export async function logSet(input: z.input<typeof setInput>) {
  const user = await requireUser();
  const v = setInput.parse(input);
  const date = todayIn((await getSettings(user.id)).timezone);
  const db = await getDb();
  await db
    .insert(schema.gymSets)
    .values({ userId: user.id, date, ...v })
    .onConflictDoUpdate({ target: [schema.gymSets.userId, schema.gymSets.date, schema.gymSets.exercise, schema.gymSets.setNo], set: { weight: v.weight, reps: v.reps } });
  revalidatePath("/gym");
  return { date };
}

/** Untick one of today's sets. */
export async function unlogSet(exercise: string, setNo: number) {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(100).parse(exercise);
  const no = z.number().int().min(1).max(20).parse(setNo);
  const date = todayIn((await getSettings(user.id)).timezone);
  const db = await getDb();
  await db
    .delete(schema.gymSets)
    .where(and(eq(schema.gymSets.userId, user.id), eq(schema.gymSets.date, date), eq(schema.gymSets.exercise, name), eq(schema.gymSets.setNo, no)));
  revalidatePath("/gym");
}
