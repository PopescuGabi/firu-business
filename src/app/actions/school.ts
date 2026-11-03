"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { schema } from "@/lib/db";
import { parseExercises } from "@/lib/gym";
import { mutateSchedule } from "@/lib/mutate";
import { nextWeekday } from "@/lib/tutoring";
import { weekdayOf } from "@/lib/time";

const time = z.string().regex(/^\d{2}:\d{2}$/);

/** One school day: start time + one subject per line. */
export async function saveSchoolDay(weekday: number, fd: FormData) {
  await mutateSchedule((db, uid) => {
    const day = z.number().int().min(1).max(7).parse(weekday);
    const subjects = String(fd.get("subjects") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    return db.transaction(async (tx) => {
      await tx.delete(schema.schoolClasses).where(and(eq(schema.schoolClasses.userId, uid), eq(schema.schoolClasses.weekday, day)));
      await tx.delete(schema.schoolDays).where(and(eq(schema.schoolDays.userId, uid), eq(schema.schoolDays.weekday, day)));
      if (subjects.length) {
        await tx.insert(schema.schoolDays).values({ userId: uid, weekday: day, startTime: time.parse(fd.get("startTime")) });
        await tx.insert(schema.schoolClasses).values(subjects.map((subject, period) => ({ userId: uid, weekday: day, period, subject })));
      }
    });
  });
}

export async function saveGymDay(weekday: number, fd: FormData) {
  await mutateSchedule((db, uid) => {
    const day = z.number().int().min(1).max(7).parse(weekday);
    const values = {
      title: z.string().trim().min(1).max(100).parse(fd.get("title")),
      durationMin: z.coerce.number().int().min(15).max(240).parse(fd.get("durationMin")),
      exercises: parseExercises(String(fd.get("exercises") ?? "")),
      timing: z.enum(["flexible", "after_school", "fixed"]).catch("flexible").parse(fd.get("timing")),
      startTime: null as string | null,
    };
    if (values.timing === "fixed") values.startTime = time.parse(fd.get("startTime"));
    return db
      .insert(schema.gymDays)
      .values({ userId: uid, weekday: day, ...values })
      .onConflictDoUpdate({ target: [schema.gymDays.userId, schema.gymDays.weekday], set: values });
  });
}

export async function addGymDay(fd: FormData) {
  await requireUser();
  await saveGymDay(z.coerce.number().int().min(1).max(7).parse(fd.get("weekday")), fd);
}

export async function deleteGymDay(weekday: number) {
  await mutateSchedule((db, uid) =>
    db.delete(schema.gymDays).where(and(eq(schema.gymDays.userId, uid), eq(schema.gymDays.weekday, weekday))),
  );
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

export async function addTutoring(fd: FormData) {
  await mutateSchedule((db, uid) => db.insert(schema.tutoring).values({ userId: uid, ...tutoringFromForm(fd) }));
}

export async function updateTutoring(id: number, fd: FormData) {
  await mutateSchedule((db, uid) =>
    db.update(schema.tutoring).set(tutoringFromForm(fd)).where(and(eq(schema.tutoring.id, id), eq(schema.tutoring.userId, uid))),
  );
}

export async function deleteTutoring(id: number) {
  await mutateSchedule((db, uid) =>
    db.delete(schema.tutoring).where(and(eq(schema.tutoring.id, id), eq(schema.tutoring.userId, uid))),
  );
}
