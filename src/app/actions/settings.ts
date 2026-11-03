"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";

const time = z.string().regex(/^\d{2}:\d{2}$/);

export async function savePlannerSettings(fd: FormData) {
  await requireUser();
  const tz = String(fd.get("timezone") ?? "");
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    throw new Error("Unknown time zone");
  }
  await saveSettings({
    displayName: String(fd.get("displayName") ?? "").trim().slice(0, 40),
    timezone: tz,
    dayStart: time.parse(fd.get("dayStart")),
    dayEnd: time.parse(fd.get("dayEnd")),
    freeDayStart: time.parse(fd.get("freeDayStart")),
    classMinutes: z.coerce.number().int().min(20).max(120).parse(fd.get("classMinutes")),
    breakMinutes: z.coerce.number().int().min(0).max(60).parse(fd.get("breakMinutes")),
  });
  revalidatePath("/", "layout");
}

export async function saveCalendarSettings(fd: FormData) {
  await requireUser();
  await saveSettings({
    calendarIds: fd.getAll("calendarIds").map(String).slice(0, 50),
  });
  revalidatePath("/", "layout");
}

export type KeyFormState = { ok: boolean; message: string } | null;

/** Local only: saves a pasted key into .env.local. The value is never sent back to the page. */
export async function saveLocalKey(_prev: KeyFormState, fd: FormData): Promise<KeyFormState> {
  await requireUser();
  const { canEditLocalEnv, LOCAL_KEYS, writeLocalEnv } = await import("@/lib/local-env");
  if (!canEditLocalEnv()) return { ok: false, message: "Keys can only be changed here on your Mac." };
  const key = z.enum(["GOOGLE_CLIENT_SECRET", "ANTHROPIC_API_KEY", "SUPABASE_DATABASE_URL"]).parse(fd.get("key"));
  const value = String(fd.get("value") ?? "").replace(/[\s"']/g, "");
  const { label, prefix } = LOCAL_KEYS[key];
  if (!value) return { ok: false, message: `Paste your ${label} first.` };
  if (!value.startsWith(prefix) || value.length < prefix.length + 10 || value.length > 300) {
    return { ok: false, message: `That doesn't look like a ${label}: it should start with ${prefix}. Nothing was saved.` };
  }
  if (key === "SUPABASE_DATABASE_URL" && /YOUR-PASSWORD|\[|\]/i.test(value)) {
    return { ok: false, message: "Replace [YOUR-PASSWORD] in the connection string with your database password first." };
  }
  writeLocalEnv(key, value);
  revalidatePath("/settings");
  return { ok: true, message: `${label} saved.` };
}

/** Travel times table: rows of from / to / minutes. An empty minutes field removes the row. */
export async function saveTravel(fd: FormData) {
  await requireUser();
  const from = fd.getAll("from").map((v) => String(v).trim());
  const to = fd.getAll("to").map((v) => String(v).trim());
  const minutes = fd.getAll("minutes").map((v) => String(v).trim());
  const travel: Record<string, number> = {};
  from.forEach((f, i) => {
    const t = to[i];
    if (!f || !t || f === t || minutes[i] === "" || f.includes(">") || t.includes(">")) return;
    travel[`${f.slice(0, 60)}>${t.slice(0, 60)}`] = z.coerce.number().int().min(0).max(600).parse(minutes[i]);
  });
  await saveSettings({ travel });
  revalidatePath("/", "layout");
}

/** Local only: builds .env.vercel for pasting into Vercel. Values are never sent back to the page. */
export async function createVercelEnvFile(_prev: KeyFormState, fd: FormData): Promise<KeyFormState> {
  await requireUser();
  const { canEditLocalEnv, writeVercelEnvFile } = await import("@/lib/local-env");
  if (!canEditLocalEnv()) return { ok: false, message: "Only available on your Mac." };
  const raw = String(fd.get("appUrl") ?? "").trim().replace(/\/+$/, "");
  const appUrl = /^[a-z0-9-]+$/i.test(raw) ? `https://${raw}.vercel.app` : raw;
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(appUrl)) {
    return { ok: false, message: "Enter your Vercel address, e.g. https://my-hub.vercel.app" };
  }
  const missing = await writeVercelEnvFile(appUrl);
  return missing.length
    ? { ok: false, message: `Created, but these are still empty: ${missing.join(", ")}. Add them in the Keys box above, then create the file again.` }
    : { ok: true, message: "Created .env.vercel and opened it in TextEdit. Select all, copy, and paste into Vercel → Environment Variables." };
}

export type SyncFormState = { ok: boolean; message: string } | null;

/** Turns two-way sync with the "Personal Hub" Google calendar on/off and runs it straight away. */
export async function saveCalendarSync(_prev: SyncFormState, fd: FormData): Promise<SyncFormState> {
  await requireUser();
  const calendarSync = fd.get("calendarSync") === "on";
  const schoolYearEnd = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).catch("").parse(fd.get("schoolYearEnd") ?? "");
  await saveSettings({ calendarSync, schoolYearEnd });
  revalidatePath("/", "layout");
  if (!calendarSync) return { ok: true, message: "Sync is off. Events already in the Personal Hub calendar stay there but stop updating." };
  const { runSync } = await import("@/lib/calendar-sync");
  return runSync();
}

export async function syncCalendarNow(): Promise<SyncFormState> {
  await requireUser();
  const { runSync } = await import("@/lib/calendar-sync");
  const result = await runSync();
  revalidatePath("/", "layout");
  return result;
}
