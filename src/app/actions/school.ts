"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { parseExercises } from "@/lib/gym";
import { createEvent, deleteEvent } from "@/lib/google/calendar";
import { getGoogleAccount } from "@/lib/google/oauth";
import { getSettings } from "@/lib/settings";
import { nextWeekday } from "@/lib/tutoring";
import { weekdayOf } from "@/lib/time";

const time = z.string().regex(/^\d{2}:\d{2}$/);

/** One school day: start time + one subject per line. */
export async function saveSchoolDay(weekday: number, fd: FormData) {
  await requireUser();
  const day = z.number().int().min(1).max(7).parse(weekday);
  const subjects = String(fd.get("subjects") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.schoolClasses).where(eq(schema.schoolClasses.weekday, day));
    await tx.delete(schema.schoolDays).where(eq(schema.schoolDays.weekday, day));
    if (subjects.length) {
      await tx.insert(schema.schoolDays).values({ weekday: day, startTime: time.parse(fd.get("startTime")) });
      await tx.insert(schema.schoolClasses).values(subjects.map((subject, period) => ({ weekday: day, period, subject })));
    }
  });
  revalidatePath("/", "layout");
}

export async function saveGymDay(weekday: number, fd: FormData) {
  await requireUser();
  const day = z.number().int().min(1).max(7).parse(weekday);
  const values = {
    title: z.string().trim().min(1).max(100).parse(fd.get("title")),
    durationMin: z.coerce.number().int().min(15).max(240).parse(fd.get("durationMin")),
    exercises: parseExercises(String(fd.get("exercises") ?? "")),
    timing: z.enum(["flexible", "after_school", "fixed"]).catch("flexible").parse(fd.get("timing")),
    startTime: null as string | null,
  };
  if (values.timing === "fixed") values.startTime = time.parse(fd.get("startTime"));
  const db = await getDb();
  await db
    .insert(schema.gymDays)
    .values({ weekday: day, ...values })
    .onConflictDoUpdate({ target: schema.gymDays.weekday, set: values });
  revalidatePath("/", "layout");
}

export async function addGymDay(fd: FormData) {
  await requireUser();
  await saveGymDay(z.coerce.number().int().min(1).max(7).parse(fd.get("weekday")), fd);
}

export async function deleteGymDay(weekday: number) {
  await requireUser();
  const db = await getDb();
  await db.delete(schema.gymDays).where(eq(schema.gymDays.weekday, weekday));
  revalidatePath("/", "layout");
}

// ── Tutoring ───────────────────────────────────────────────
const tutoringInput = z
  .object({
    subject: z.string().trim().min(1).max(100),
    weekday: z.coerce.number().int().min(1).max(7),
    start: time,
    end: time,
    everyWeeks: z.coerce.number().int().min(1).max(4),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    place: z.string().trim().min(1).max(60).refine((p) => !p.includes(">")),
  })
  .refine((t) => t.end > t.start, { message: "The session must end after it starts" });

function tutoringFromForm(fd: FormData) {
  const t = tutoringInput.parse({
    subject: fd.get("subject"),
    weekday: fd.get("weekday"),
    start: fd.get("start"),
    end: fd.get("end"),
    everyWeeks: fd.get("everyWeeks"),
    startDate: fd.get("startDate") || null,
    place: fd.get("online") === "on" ? "online" : fd.get("place") || "online",
  });
  // The first session must fall on the chosen weekday.
  const today = new Date().toISOString().slice(0, 10);
  const startDate = t.startDate && weekdayOf(t.startDate) === t.weekday ? t.startDate : nextWeekday(t.weekday, t.startDate ?? today);
  return { ...t, startDate };
}

/** Adds a repeating Google Calendar event for a session; returns its id (or null when Google isn't connected). */
async function syncToGoogle(t: ReturnType<typeof tutoringFromForm>) {
  if (!(await getGoogleAccount())?.accessToken) return null;
  const settings = await getSettings();
  return createEvent(settings.targetCalendarId, {
    title: `Tutoring · ${t.subject}`,
    description: "Added from Personal Hub (School → Tutoring).",
    start: `${t.startDate}T${t.start}:00`,
    end: `${t.startDate}T${t.end}:00`,
    timeZone: settings.timezone,
    recurrence: [`RRULE:FREQ=WEEKLY;INTERVAL=${t.everyWeeks}`],
  });
}

async function removeFromGoogle(gcalEventId: string | null) {
  if (!gcalEventId) return;
  const settings = await getSettings();
  await deleteEvent(settings.targetCalendarId, gcalEventId);
}

export async function addTutoring(fd: FormData) {
  await requireUser();
  const t = tutoringFromForm(fd);
  const gcalEventId = fd.get("google") === "on" ? await syncToGoogle(t) : null;
  const db = await getDb();
  await db.insert(schema.tutoring).values({ ...t, gcalEventId });
  revalidatePath("/", "layout");
}

export async function updateTutoring(id: number, fd: FormData) {
  await requireUser();
  const t = tutoringFromForm(fd);
  const db = await getDb();
  const [old] = await db.select().from(schema.tutoring).where(eq(schema.tutoring.id, id));
  if (!old) return;
  const wantGoogle = fd.get("google") === "on";
  // Only rebuild the Google Calendar event when something it shows changed.
  const sameEvent =
    wantGoogle === Boolean(old.gcalEventId) &&
    (["subject", "weekday", "start", "end", "everyWeeks", "startDate"] as const).every((k) => old[k] === t[k]);
  let gcalEventId = old.gcalEventId;
  if (!sameEvent) {
    await removeFromGoogle(old.gcalEventId);
    gcalEventId = wantGoogle ? await syncToGoogle(t) : null;
  }
  await db.update(schema.tutoring).set({ ...t, gcalEventId }).where(eq(schema.tutoring.id, id));
  revalidatePath("/", "layout");
}

export async function deleteTutoring(id: number) {
  await requireUser();
  const db = await getDb();
  const [old] = await db.delete(schema.tutoring).where(eq(schema.tutoring.id, id)).returning();
  await removeFromGoogle(old?.gcalEventId ?? null);
  revalidatePath("/", "layout");
}
