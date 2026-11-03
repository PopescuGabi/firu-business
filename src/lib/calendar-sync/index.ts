import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, asc, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb, schema } from "../db";
import { getAccessToken } from "../google/oauth";
import {
  changedEvents,
  deleteEvent,
  getEvent,
  insertEvent,
  listCalendars,
  patchEvent,
  type EventBody,
  type RawEvent,
} from "../google/calendar";
import { getSettings } from "../settings";
import { travelTime } from "../travel";
import { buildDesired, changeFromRemote, MARK, sameSignature, signature, type DesiredEvent, type HubChange, type Signature } from "./model";

export const HUB_CALENDAR_NAME = "Personal Hub";

export type SyncResult = {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  deleted: number;
  pulled: number;
};

const empty = (message: string, ok = false): SyncResult => ({ ok, message, created: 0, updated: 0, deleted: 0, pulled: 0 });

/** Local date + HH:mm for a Google time (with offset) or one of ours (already local). */
function localizer(tz: string) {
  return (iso: string) => {
    if (!/(Z|[+-]\d\d:\d\d)$/.test(iso)) return { date: iso.slice(0, 10), hm: iso.slice(11, 16) };
    const d = new TZDate(iso, tz);
    return { date: format(d, "yyyy-MM-dd"), hm: format(d, "HH:mm") };
  };
}

const bodyOf = (d: DesiredEvent): EventBody => ({
  summary: d.summary,
  description: d.description,
  location: d.location ?? "",
  start: d.start,
  end: d.end,
  ...(d.recurrence ? { recurrence: d.recurrence } : {}),
});

const untilOf = (rule: string) => rule.match(/UNTIL=(\d{8})/)?.[1] ?? null;
/** True when a series now ends earlier than the one the hub wrote. */
const truncated = (now: string, before: string) => {
  const u = untilOf(now);
  const b = untilOf(before);
  return Boolean(u && (!b || u < b));
};

const isGone = (err: unknown) => err instanceof Error && /Google API (404|410)/.test(err.message);

async function setSetting(key: string, value: unknown) {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return (row?.value as T) ?? null;
}

/** One sync at a time across every server instance (expires after 90 s if a run dies). */
async function acquireLock() {
  const db = await getDb();
  const value = JSON.stringify({ at: new Date().toISOString() });
  const res = (await db.execute(sql`
    insert into settings (key, value) values ('calendarSyncLock', ${value}::jsonb)
    on conflict (key) do update set value = excluded.value
    where (settings.value->>'at')::timestamptz < now() - interval '90 seconds'
    returning key`)) as unknown as { rows?: unknown[] } | unknown[];
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return rows.length > 0;
}

async function releaseLock() {
  const db = await getDb();
  await db.delete(schema.settings).where(eq(schema.settings.key, "calendarSyncLock"));
}

export async function findHubCalendar() {
  const calendars = await listCalendars();
  return calendars.find((c) => c.name.trim().toLowerCase() === HUB_CALENDAR_NAME.toLowerCase()) ?? null;
}

async function loadHub(tz: string) {
  const db = await getDb();
  const settings = await getSettings();
  const [schoolDays, classes, gym, tutoring, blocks, tasks] = await Promise.all([
    db.select().from(schema.schoolDays),
    db.select().from(schema.schoolClasses).orderBy(asc(schema.schoolClasses.period)),
    db.select().from(schema.gymDays),
    db.select().from(schema.tutoring),
    db.select().from(schema.planBlocks).where(eq(schema.planBlocks.status, "accepted")),
    db.select().from(schema.tasks),
  ]);
  return buildDesired({
    timezone: tz,
    today: format(new TZDate(new Date(), tz), "yyyy-MM-dd"),
    schoolYearEnd: settings.schoolYearEnd || null,
    classMinutes: settings.classMinutes,
    breakMinutes: settings.breakMinutes,
    schoolGymTravel: travelTime(settings.travel, "school", "gym") ?? 0,
    schoolDays,
    classes,
    gym,
    tutoring,
    blocks,
    tasks,
  });
}

/** An event deleted on the phone removes the item in the hub (a task only loses its due date). */
async function applyDelete(key: string) {
  const db = await getDb();
  const [kind, a, b] = key.split(":");
  if (kind === "class") {
    const weekday = Number(a);
    const period = Number(b);
    await db.transaction(async (tx) => {
      const rows = await tx.select().from(schema.schoolClasses).where(eq(schema.schoolClasses.weekday, weekday)).orderBy(asc(schema.schoolClasses.period));
      const keep = rows.filter((r) => r.period !== period);
      await tx.delete(schema.schoolClasses).where(eq(schema.schoolClasses.weekday, weekday));
      if (keep.length) await tx.insert(schema.schoolClasses).values(keep.map((r, i) => ({ weekday, period: i, subject: r.subject })));
      else await tx.delete(schema.schoolDays).where(eq(schema.schoolDays.weekday, weekday));
    });
  } else if (kind === "gym") {
    await db.delete(schema.gymDays).where(eq(schema.gymDays.weekday, Number(a)));
  } else if (kind === "tutoring") {
    await db.delete(schema.tutoring).where(eq(schema.tutoring.id, Number(a)));
  } else if (kind === "block") {
    await db.delete(schema.planBlocks).where(eq(schema.planBlocks.id, Number(a)));
  } else if (kind === "task") {
    await db.update(schema.tasks).set({ due: null }).where(eq(schema.tasks.id, Number(a)));
  }
}

/** Applies a phone edit; returns the item's new key when it moved (a gym day on another weekday). */
async function applyChange(c: HubChange): Promise<string | void> {
  const db = await getDb();
  if (c.kind === "class") {
    await db
      .update(schema.schoolClasses)
      .set({ subject: c.subject })
      .where(and(eq(schema.schoolClasses.weekday, c.weekday), eq(schema.schoolClasses.period, c.period)));
  } else if (c.kind === "gym") {
    let weekday = c.weekday;
    if (c.newWeekday !== c.weekday) {
      const [taken] = await db.select().from(schema.gymDays).where(eq(schema.gymDays.weekday, c.newWeekday));
      if (!taken) weekday = c.newWeekday;
    }
    await db
      .update(schema.gymDays)
      .set({ weekday, title: c.title, timing: "fixed", startTime: c.startTime, durationMin: c.durationMin })
      .where(eq(schema.gymDays.weekday, c.weekday));
    return `gym:${weekday}`;
  } else if (c.kind === "tutoring") {
    const { id, ...rest } = c;
    await db.update(schema.tutoring).set(rest).where(eq(schema.tutoring.id, id));
  } else if (c.kind === "block") {
    const { id, ...rest } = c;
    await db.update(schema.planBlocks).set(rest).where(eq(schema.planBlocks.id, id));
  } else if (c.kind === "task") {
    await db.update(schema.tasks).set({ due: c.due, title: c.title }).where(eq(schema.tasks.id, c.id));
  }
}

/** Before this sync existed, tutoring and accepted blocks were written to the main calendar: move them. */
async function migrateOldEvents(oldCalendarId: string) {
  const db = await getDb();
  const old = [
    ...(await db.select({ id: schema.tutoring.id, ev: schema.tutoring.gcalEventId }).from(schema.tutoring)).map((r) => ({ ...r, t: "tutoring" as const })),
    ...(await db.select({ id: schema.planBlocks.id, ev: schema.planBlocks.gcalEventId }).from(schema.planBlocks)).map((r) => ({ ...r, t: "block" as const })),
  ].filter((r) => r.ev);
  for (const r of old) {
    await deleteEvent(oldCalendarId, r.ev!).catch(() => {});
    if (r.t === "tutoring") await db.update(schema.tutoring).set({ gcalEventId: null }).where(eq(schema.tutoring.id, r.id));
    else await db.update(schema.planBlocks).set({ gcalEventId: null }).where(eq(schema.planBlocks.id, r.id));
  }
}

export async function runSync({ waitMs = 0 } = {}): Promise<SyncResult> {
  const settings = await getSettings();
  if (!settings.calendarSync) return empty("Calendar sync is off.");
  try {
    await getAccessToken();
  } catch {
    return empty("Google isn't connected.");
  }
  let locked = await acquireLock();
  for (const until = Date.now() + waitMs; !locked && Date.now() < until; locked = await acquireLock()) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!locked) return empty("A sync is already running.", true);
  await setSetting("calendarSyncTriedAt", new Date().toISOString());
  const tz = settings.timezone;
  const toLocal = localizer(tz);
  const result = empty("", true);
  try {
    const cal = await findHubCalendar();
    if (!cal) return empty(`Create a Google calendar named “${HUB_CALENDAR_NAME}” first.`);
    const db = await getDb();
    await migrateOldEvents(settings.targetCalendarId || "primary");

    // Links to another calendar (renamed or re-created): start over in this one.
    await db.delete(schema.calendarLinks).where(sql`${schema.calendarLinks.calendarId} <> ${cal.id}`);

    // 1. Pull: apply edits made in Google Calendar (on the phone) to the hub.
    const startedAt = new Date().toISOString();
    const lastPull = await getSetting<string>("calendarSyncPulledAt");
    if (lastPull) {
      const links = await db.select().from(schema.calendarLinks);
      const byEvent = new Map(links.map((l) => [l.eventId, l]));
      const since = new Date(Date.parse(lastPull) - 2 * 60_000).toISOString();
      const changed = await changedEvents(cal.id, since);
      // New series that "this and following events" edits create (Google copies our description into them).
      const orphans = changed.filter(
        (e) => e.status !== "cancelled" && !byEvent.has(e.id) && !e.recurringEventId && e.recurrence?.length && (e.description ?? "").includes(MARK),
      );
      const deletes: string[] = [];
      for (let e of changed) {
        let link = byEvent.get(e.id);
        if (!link || link.key.startsWith("retired:")) continue; // the user's own events, or single changed occurrences
        if (e.updated && link.remoteUpdated && e.updated <= link.remoteUpdated) continue; // our own write
        if (e.status === "cancelled") {
          deletes.push(link.key);
          continue;
        }
        let sig = signature(e, toLocal);
        if (truncated(sig.rule, (link.written as Signature).rule)) {
          // The series was split on the phone: the hub follows the new part; the old part stays as history.
          const next = orphans.find((o) => o.summary === e.summary) ?? (orphans.length === 1 ? orphans[0] : undefined);
          if (next) {
            orphans.splice(orphans.indexOf(next), 1);
            await db.insert(schema.calendarLinks).values({ ...link, key: `retired:${link.eventId}`, written: sig, remoteUpdated: e.updated ?? null });
            await db.update(schema.calendarLinks).set({ eventId: next.id }).where(eq(schema.calendarLinks.key, link.key));
            link = { ...link, eventId: next.id };
            e = next;
            sig = signature(e, toLocal);
          }
        }
        let key = link.key;
        if (!sameSignature(sig, link.written as Signature)) {
          const change = changeFromRemote(link.key, e, toLocal);
          if (change) key = (await applyChange(change)) ?? key;
          result.pulled++;
        }
        if (key !== link.key) await db.delete(schema.calendarLinks).where(eq(schema.calendarLinks.key, key));
        await db
          .update(schema.calendarLinks)
          .set({ key, eventId: e.id, written: sig, remoteUpdated: e.updated ?? null, updatedAt: new Date() })
          .where(eq(schema.calendarLinks.key, link.key));
      }
      // Later class periods first, so renumbering after one delete doesn't shift the next.
      deletes.sort((a, b) => Number(b.split(":")[2] ?? 0) - Number(a.split(":")[2] ?? 0));
      for (const key of deletes) {
        await applyDelete(key);
        await db.delete(schema.calendarLinks).where(eq(schema.calendarLinks.key, key));
        result.pulled++;
      }
    }
    await setSetting("calendarSyncPulledAt", startedAt);

    // 2. Push: make the calendar match the hub.
    const desired = await loadHub(tz);
    const links = new Map((await db.select().from(schema.calendarLinks)).map((l) => [l.key, l]));
    for (const d of desired) {
      const sig = signature(d, toLocal);
      const link = links.get(d.key);
      let ev: RawEvent | null = null;
      if (!link) {
        ev = await insertEvent(cal.id, bodyOf(d));
        result.created++;
      } else if (!sameSignature(sig, link.written as Signature)) {
        try {
          const body = bodyOf(d);
          if (d.recurrence) {
            // Keep the series' original start date (and its history) when only time or details change.
            const current = await getEvent(cal.id, link.eventId);
            const cur = current.start.dateTime ? toLocal(current.start.dateTime) : null;
            const want = toLocal(d.start.dateTime!);
            if (cur && sig.day === signature({ ...d, start: current.start, end: current.end }, toLocal).day) {
              body.start = { dateTime: `${cur.date}T${want.hm}:00`, timeZone: tz };
              body.end = { dateTime: `${cur.date}T${toLocal(d.end.dateTime!).hm}:00`, timeZone: tz };
            }
          }
          ev = await patchEvent(cal.id, link.eventId, body);
        } catch (err) {
          if (!isGone(err)) throw err;
          ev = await insertEvent(cal.id, bodyOf(d));
        }
        result.updated++;
      }
      if (ev) {
        const row = { calendarId: cal.id, eventId: ev.id, written: sig, remoteUpdated: ev.updated ?? null, updatedAt: new Date() };
        await db
          .insert(schema.calendarLinks)
          .values({ key: d.key, ...row })
          .onConflictDoUpdate({ target: schema.calendarLinks.key, set: row });
      }
      links.delete(d.key);
    }

    // 3. Items gone from the hub: remove their events.
    for (const link of links.values()) {
      if (link.key.startsWith("retired:")) continue;
      await deleteEvent(cal.id, link.eventId).catch((err) => {
        if (!isGone(err)) throw err;
      });
      await db.delete(schema.calendarLinks).where(eq(schema.calendarLinks.key, link.key));
      result.deleted++;
    }

    await setSetting("calendarSyncAt", new Date().toISOString());
    const parts = [
      result.created && `${result.created} added`,
      result.updated && `${result.updated} updated`,
      result.deleted && `${result.deleted} removed`,
      result.pulled && `${result.pulled} change${result.pulled === 1 ? "" : "s"} from your calendar`,
    ].filter(Boolean);
    result.message = parts.length ? `Synced: ${parts.join(", ")}.` : "Everything is already in sync.";
    return result;
  } catch (err) {
    console.error("Calendar sync failed", err);
    return { ...result, ok: false, message: err instanceof Error ? err.message : "Calendar sync failed." };
  } finally {
    await releaseLock().catch(() => {});
  }
}

/** Page loads: pick up phone edits if the last sync is older than a minute (the page waits at most ~4 s). */
export async function syncIfStale(maxAgeMs = 60_000, waitMs = 4_000) {
  const settings = await getSettings();
  if (!settings.calendarSync) return;
  // Throttled on the last attempt, so a failing sync doesn't slow every page.
  const last = await getSetting<string>("calendarSyncTriedAt");
  if (last && Date.now() - Date.parse(last) < maxAgeMs) return;
  const sync = runSync().catch((err) => console.error("Calendar sync failed", err));
  try {
    after(() => sync); // a long first sync keeps running after the page is sent
  } catch {
    // Outside a request: just wait below.
  }
  await Promise.race([sync, new Promise((r) => setTimeout(r, waitMs))]);
}

/** After a change in the hub: sync once the response has been sent. */
export function requestSync() {
  try {
    after(() => runSync({ waitMs: 20_000 }).catch((err) => console.error("Calendar sync failed", err)));
  } catch {
    // Outside a request (scripts): nothing to schedule.
  }
}

export async function lastSyncInfo() {
  return { at: await getSetting<string>("calendarSyncAt") };
}
