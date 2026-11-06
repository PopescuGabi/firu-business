import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { APP_NAME, pickHubCalendar } from "../brand";
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
import { getSetting, getSettings, setSetting } from "../settings";
import { buildDesired, changeFromRemote, hasMark, sameSignature, signature, type DesiredEvent, type HubChange, type Signature } from "./model";

export const HUB_CALENDAR_NAME = APP_NAME;

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

/** Runs `fn` over `items`, at most `n` at a time. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const isGone = (err: unknown) => err instanceof Error && /Google API (404|410)/.test(err.message);

/** One sync per person at a time, across every server instance (expires after 90 s if a run dies). */
async function acquireLock(uid: number) {
  const db = await getDb();
  const value = JSON.stringify({ at: new Date().toISOString() });
  const res = (await db.execute(sql`
    insert into settings (user_id, key, value) values (${uid}, 'calendarSyncLock', ${value}::jsonb)
    on conflict (user_id, key) do update set value = excluded.value
    where (settings.value->>'at')::timestamptz < now() - interval '90 seconds'
    returning key`)) as unknown as { rows?: unknown[] } | unknown[];
  const rows = Array.isArray(res) ? res : (res.rows ?? []);
  return rows.length > 0;
}

async function releaseLock(uid: number) {
  const db = await getDb();
  await db.delete(schema.settings).where(and(eq(schema.settings.userId, uid), eq(schema.settings.key, "calendarSyncLock")));
}

export async function findHubCalendar(uid: number) {
  const calendars = await listCalendars(uid);
  return pickHubCalendar(calendars);
}

async function loadHub(uid: number, tz: string) {
  const db = await getDb();
  const [blocks, tasks] = await Promise.all([
    db.select().from(schema.planBlocks).where(and(eq(schema.planBlocks.userId, uid), eq(schema.planBlocks.status, "accepted"))),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, uid)),
  ]);
  // Anything no longer built here (e.g. old school, gym and tutoring events) is removed from the calendar by the push pass.
  return buildDesired({ timezone: tz, today: format(new TZDate(new Date(), tz), "yyyy-MM-dd"), blocks, tasks });
}

/** An event deleted on the phone removes the item in the hub (a task only loses its due date). */
async function applyDelete(uid: number, key: string) {
  const db = await getDb();
  const [kind, a] = key.split(":");
  if (kind === "block") {
    await db.delete(schema.planBlocks).where(and(eq(schema.planBlocks.userId, uid), eq(schema.planBlocks.id, Number(a))));
  } else if (kind === "task") {
    await db.update(schema.tasks).set({ due: null }).where(and(eq(schema.tasks.userId, uid), eq(schema.tasks.id, Number(a))));
  }
}

/** Applies a phone edit to the plan block or task behind it. */
async function applyChange(uid: number, c: HubChange): Promise<string | void> {
  const db = await getDb();
  if (c.kind === "block") {
    const { id, ...rest } = c;
    await db.update(schema.planBlocks).set(rest).where(and(eq(schema.planBlocks.userId, uid), eq(schema.planBlocks.id, id)));
  } else if (c.kind === "task") {
    await db.update(schema.tasks).set({ due: c.due, title: c.title }).where(and(eq(schema.tasks.userId, uid), eq(schema.tasks.id, c.id)));
  }
}

export async function runSync(uid: number, { waitMs = 0 } = {}): Promise<SyncResult> {
  const settings = await getSettings(uid);
  if (!settings.calendarSync) return empty("Calendar sync is off.");
  try {
    await getAccessToken(uid);
  } catch {
    return empty("Google isn't connected.");
  }
  let locked = await acquireLock(uid);
  for (const until = Date.now() + waitMs; !locked && Date.now() < until; locked = await acquireLock(uid)) {
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!locked) return empty("A sync is already running.", true);
  await setSetting(uid, "calendarSyncTriedAt", new Date().toISOString());
  const tz = settings.timezone;
  const toLocal = localizer(tz);
  const result = empty("", true);
  try {
    const cal = await findHubCalendar(uid);
    if (!cal) return empty(`Create a Google calendar named “${HUB_CALENDAR_NAME}” first.`);
    const db = await getDb();

    // Links to another calendar (renamed or re-created): start over in this one.
    const mine = eq(schema.calendarLinks.userId, uid);
    const linkKey = (key: string) => and(mine, eq(schema.calendarLinks.key, key));
    await db.delete(schema.calendarLinks).where(and(mine, sql`${schema.calendarLinks.calendarId} <> ${cal.id}`));

    // 1. Pull: apply edits made in Google Calendar (on the phone) to the hub.
    const startedAt = new Date().toISOString();
    const lastPull = await getSetting<string>(uid, "calendarSyncPulledAt");
    if (lastPull) {
      const links = await db.select().from(schema.calendarLinks).where(mine);
      const byEvent = new Map(links.map((l) => [l.eventId, l]));
      const since = new Date(Date.parse(lastPull) - 2 * 60_000).toISOString();
      const changed = await changedEvents(uid, cal.id, since);
      // New series that "this and following events" edits create (Google copies our description into them).
      const orphans = changed.filter(
        (e) => e.status !== "cancelled" && !byEvent.has(e.id) && !e.recurringEventId && e.recurrence?.length && hasMark(e.description),
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
            // scoped: copies this person's own link row (its userId included)
            await db.insert(schema.calendarLinks).values({ ...link, key: `retired:${link.eventId}`, written: sig, remoteUpdated: e.updated ?? null });
            await db.update(schema.calendarLinks).set({ eventId: next.id }).where(linkKey(link.key));
            link = { ...link, eventId: next.id };
            e = next;
            sig = signature(e, toLocal);
          }
        }
        let key = link.key;
        if (!sameSignature(sig, link.written as Signature)) {
          const change = changeFromRemote(link.key, e, toLocal);
          if (change) key = (await applyChange(uid, change)) ?? key;
          result.pulled++;
        }
        if (key !== link.key) await db.delete(schema.calendarLinks).where(linkKey(key));
        await db
          .update(schema.calendarLinks)
          .set({ key, eventId: e.id, written: sig, remoteUpdated: e.updated ?? null, updatedAt: new Date() })
          .where(linkKey(link.key));
      }
      for (const key of deletes) {
        await applyDelete(uid, key);
        await db.delete(schema.calendarLinks).where(linkKey(key));
        result.pulled++;
      }
    }
    await setSetting(uid, "calendarSyncPulledAt", startedAt);

    // 2. Push: make the calendar match the hub.
    const desired = await loadHub(uid, tz);
    const links = new Map((await db.select().from(schema.calendarLinks).where(mine)).map((l) => [l.key, l]));
    // Our events without a link (a run cut off between writing an event and saving its link): reuse or remove them.
    const linkedIds = new Set([...links.values()].map((l) => l.eventId));
    const strays = (await changedEvents(uid, cal.id)).filter(
      (e) => e.status !== "cancelled" && !e.recurringEventId && !linkedIds.has(e.id) && hasMark(e.description),
    );
    await pool(desired, 5, async (d) => {
      const sig = signature(d, toLocal);
      const link = links.get(d.key);
      let ev: RawEvent | null = null;
      if (!link) {
        const i = strays.findIndex((e) => sameSignature(signature(e, toLocal), sig));
        if (i >= 0) ev = strays.splice(i, 1)[0];
        else {
          ev = await insertEvent(uid, cal.id, bodyOf(d));
          result.created++;
        }
      } else if (!sameSignature(sig, link.written as Signature)) {
        try {
          const body = bodyOf(d);
          if (d.recurrence) {
            // Keep the series' original start date (and its history) when only time or details change.
            const current = await getEvent(uid, cal.id, link.eventId);
            const cur = current.start.dateTime ? toLocal(current.start.dateTime) : null;
            const want = toLocal(d.start.dateTime!);
            if (cur && sig.day === signature({ ...d, start: current.start, end: current.end }, toLocal).day) {
              body.start = { dateTime: `${cur.date}T${want.hm}:00`, timeZone: tz };
              body.end = { dateTime: `${cur.date}T${toLocal(d.end.dateTime!).hm}:00`, timeZone: tz };
            }
          }
          ev = await patchEvent(uid, cal.id, link.eventId, body);
        } catch (err) {
          if (!isGone(err)) throw err;
          ev = await insertEvent(uid, cal.id, bodyOf(d));
        }
        result.updated++;
      }
      if (ev) {
        const row = { calendarId: cal.id, eventId: ev.id, written: sig, remoteUpdated: ev.updated ?? null, updatedAt: new Date() };
        await db
          .insert(schema.calendarLinks)
          .values({ userId: uid, key: d.key, ...row })
          .onConflictDoUpdate({ target: [schema.calendarLinks.userId, schema.calendarLinks.key], set: row });
      }
      links.delete(d.key);
    });
    for (const e of strays) {
      await deleteEvent(uid, cal.id, e.id);
      result.deleted++;
    }

    // 3. Items gone from the hub: remove their events.
    for (const link of links.values()) {
      if (link.key.startsWith("retired:")) continue;
      await deleteEvent(uid, cal.id, link.eventId).catch((err) => {
        if (!isGone(err)) throw err;
      });
      await db.delete(schema.calendarLinks).where(linkKey(link.key));
      result.deleted++;
    }

    await setSetting(uid, "calendarSyncAt", new Date().toISOString());
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
    await releaseLock(uid).catch(() => {});
  }
}

/**
 * Page loads: pick up phone edits if the last sync is older than a minute. The sync runs after the
 * page is sent, so it never slows the page down; its changes show on the next page you open.
 */
export async function syncIfStale(uid: number, maxAgeMs = 60_000) {
  const settings = await getSettings(uid);
  if (!settings.calendarSync) return;
  // Throttled on the last attempt, so a failing sync doesn't slow every page.
  const last = await getSetting<string>(uid, "calendarSyncTriedAt");
  if (last && Date.now() - Date.parse(last) < maxAgeMs) return;
  const sync = () => runSync(uid).catch((err) => console.error("Calendar sync failed", err));
  try {
    after(sync);
  } catch {
    await sync(); // outside a request
  }
}

/** After a change in the hub: sync once the response has been sent. */
export function requestSync(uid: number) {
  try {
    after(() => runSync(uid, { waitMs: 20_000 }).catch((err) => console.error("Calendar sync failed", err)));
  } catch {
    // Outside a request (scripts): nothing to schedule.
  }
}

export async function lastSyncInfo(uid: number) {
  return { at: await getSetting<string>(uid, "calendarSyncAt") };
}
