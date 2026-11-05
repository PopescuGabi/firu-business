import { and, eq, gte, sql } from "drizzle-orm";
import { CalendarDays, FolderOpen, LogOut, Mail, Sparkles } from "lucide-react";
import { AnthropicKeyForm, DeleteAccountForm, InviteForm, RemoveMember, WithdrawInvite } from "@/components/account-forms";
import { BackgroundPicker } from "@/components/background-picker";
import { AddressList, MapsKeyForm } from "@/components/maps-settings";
import { SectionsForm } from "@/components/sections-form";
import { CalendarSyncForm } from "@/components/calendar-sync-form";
import { KeyForm } from "@/components/key-form";
import { VercelEnvForm } from "@/components/vercel-env-form";
import { Submit } from "@/components/submit";
import { buttonClass, Card, Field, List, Notice, PageHeader, Row, Section } from "@/components/ui";
import { saveCalendarSettings, savePlannerSettings, saveTravel } from "@/app/actions/settings";
import { claudeAvailable, MODELS, PRICES } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import { photoVersion } from "@/lib/background";
import { mapsAvailable, TRAVEL_MODES } from "@/lib/google/maps";
import { listPlaces } from "@/lib/places";
import { HUB_CALENDAR_NAME, lastSyncInfo } from "@/lib/calendar-sync";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { listCalendars, type CalendarInfo } from "@/lib/google/calendar";
import { folderUrl } from "@/lib/google/drive";
import { GMAIL_SCOPES, getGoogleAccount, GOOGLE_SCOPES, hasScope } from "@/lib/google/oauth";
import { listMembers } from "@/lib/users";
import { canEditLocalEnv, LOCAL_KEYS, type LocalKey } from "@/lib/local-env";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };


export default async function SettingsPage() {
  const user = await requireUser();
  const db = await getDb();
  const settings = await getSettings(user.id);
  const account = await getGoogleAccount(user.id);
  const claudeOn = await claudeAvailable(user.id);
  const photo = await photoVersion(user.id);
  const [mapsOn, savedPlaces] = await Promise.all([mapsAvailable(user.id), listPlaces(user.id)]);
  const [me] = await db.select({ key: schema.users.anthropicKey }).from(schema.users).where(eq(schema.users.id, user.id));
  const gmailOn = GMAIL_SCOPES.every((s) => hasScope(account, s));
  const members = user.role === "owner" ? await listMembers() : null;
  const connected = Boolean(account?.accessToken);
  const missingScopes = connected ? GOOGLE_SCOPES.filter((s) => s.startsWith("https") && !account?.scope?.includes(s)) : [];

  let calendars: CalendarInfo[] = [];
  let calendarError: string | null = null;
  if (connected) {
    try {
      calendars = await listCalendars(user.id);
    } catch (err) {
      calendarError = err instanceof Error ? err.message : "Could not load calendars";
    }
  }

  const tutoringPlaces = (await db.select({ place: schema.tutoring.place }).from(schema.tutoring).where(eq(schema.tutoring.userId, user.id))).map((t) => t.place);
  const places = [...new Set(["school", "home", "gym", "online", ...tutoringPlaces, ...Object.keys(settings.travel).flatMap((k) => k.split(">"))])];

  // Each model priced at its own list rate (Opus for content, Sonnet for analysis, Haiku for quick jobs).
  const usage = async (since: Date) => {
    const rows = await db
      .select({
        model: schema.aiUsage.model,
        n: sql<number>`count(*)::int`,
        input: sql<number>`coalesce(sum(${schema.aiUsage.inputTokens}), 0)::int`,
        output: sql<number>`coalesce(sum(${schema.aiUsage.outputTokens}), 0)::int`,
      })
      .from(schema.aiUsage)
      .where(and(eq(schema.aiUsage.userId, user.id), gte(schema.aiUsage.createdAt, since)))
      .groupBy(schema.aiUsage.model);
    return rows.reduce(
      (t, r) => {
        const [pin, pout] = PRICES[r.model] ?? PRICES[MODELS.content];
        return { n: t.n + r.n, input: t.input + r.input, output: t.output + r.output, cost: t.cost + (r.input * pin + r.output * pout) / 1_000_000 };
      },
      { n: 0, input: 0, output: 0, cost: 0 },
    );
  };
  const [hour, month] = await Promise.all([usage(new Date(Date.now() - 3600_000)), usage(new Date(Date.now() - 30 * 86400_000))]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Settings" />

      <Section title="Connections">
        <List>
          <Row>
            <span className="grid size-8 place-items-center rounded-lg bg-blue text-white">
              <CalendarDays size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Google Calendar & Drive</p>
              <p className="truncate text-[13px] text-label-2">
                {!env.googleConfigured()
                  ? "Not set up: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
                  : connected
                    ? `Connected as ${account!.email}`
                    : "Not connected"}
              </p>
            </div>
            {env.googleConfigured() && (
              <a href="/api/auth/google" className={buttonClass(connected ? "gray" : "filled", "sm")}>
                {connected ? "Reconnect" : "Connect"}
              </a>
            )}
          </Row>
          {account?.rootFolderId && (
            <Row>
              <span className="grid size-8 place-items-center rounded-lg bg-green text-white">
                <FolderOpen size={17} />
              </span>
              <p className="flex-1 font-medium">Drive folder “Personal Hub”</p>
              <a href={folderUrl(account.rootFolderId)} target="_blank" rel="noreferrer" className={buttonClass("plain", "sm")}>
                Open
              </a>
            </Row>
          )}
          {user.modules.includes("email") && (
            <Row>
              <span className="grid size-8 place-items-center rounded-lg bg-red text-white">
                <Mail size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Gmail</p>
                <p className="text-[13px] text-label-2">{gmailOn ? "Connected: read and send" : "Not connected"}</p>
              </div>
              {connected && (
                <a href="/api/auth/google?gmail=1" className={buttonClass(gmailOn ? "gray" : "filled", "sm")}>
                  {gmailOn ? "Reconnect" : "Connect Gmail"}
                </a>
              )}
            </Row>
          )}
          <Row>
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-orange to-pink text-white">
              <Sparkles size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Claude</p>
              <p className="text-[13px] text-label-2">
                {claudeOn
                  ? `Opus 5.5 for content · Sonnet 5.5 for analysis and the gym coach · Haiku 5.5 for planning, email and finance · max ${env.aiMaxPerHour()} requests/hour${me?.key ? " · your key" : ""}`
                  : "Copy-paste mode (Claude app). Add your own API key below to use Claude inside the site."}
              </p>
            </div>
          </Row>
        </List>
        {missingScopes.length > 0 && (
          <Notice tone="orange">Some Google permissions are missing. Tap Reconnect and allow Calendar and Drive.</Notice>
        )}
      </Section>

      <Section title="Sections" className="scroll-mt-6" footer="Turned-off sections disappear from the sidebar and Home; their data stays.">
        <div id="sections">
          <SectionsForm initial={user.modules} />
        </div>
      </Section>

      <Section title="Appearance" footer="Auto follows your device's light or dark mode. Your own photo stays private to you. Browsers can't read your desktop wallpaper directly, so “Use my wallpaper” opens your Pictures folder to pick its file.">
        <Card className="p-4">
          <BackgroundPicker current={settings.background} theme={settings.theme} sounds={settings.sounds} photoUrl={photo ? `/api/background?v=${photo}` : null} />
        </Card>
      </Section>

      <Section title="Your Anthropic key">
        <Card className="p-4">
          <AnthropicKeyForm isSet={Boolean(me?.key)} />
        </Card>
      </Section>

      {members && (
        <Section title="Members" footer="Personal Hub is invite only: people sign in with the Google account you invite. Each person only sees their own data.">
          <Card className="flex flex-col gap-4 p-4">
            <InviteForm />
            <List className="!shadow-none">
              {members.users.map((m) => (
                <Row key={m.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name || m.email}</p>
                    <p className="truncate text-[13px] text-label-2">
                      {m.email} · {m.role === "owner" ? "Owner" : m.onboarded ? "Member" : "Invited, setting up"}
                    </p>
                  </div>
                  {m.role !== "owner" && <RemoveMember uid={m.id} email={m.email} />}
                </Row>
              ))}
              {members.pending.map((i) => (
                <Row key={i.email}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.email}</p>
                    <p className="text-[13px] text-label-2">Invited, hasn&apos;t signed in yet</p>
                  </div>
                  <WithdrawInvite email={i.email} />
                </Row>
              ))}
            </List>
          </Card>
        </Section>
      )}

      {user.role === "owner" && canEditLocalEnv() && (
        <Section title="Keys (this Mac only)" footer="Saved straight into your local config file and never shown again. The Supabase connection string is only used to copy your data online and for the Vercel file; this Mac keeps using its local database.">
          <Card className="space-y-4 p-4">
            {(Object.keys(LOCAL_KEYS) as LocalKey[]).map((k) => (
              <KeyForm key={k} name={k} label={LOCAL_KEYS[k].label} prefix={LOCAL_KEYS[k].prefix} isSet={Boolean(process.env[k])} />
            ))}
            <VercelEnvForm />
          </Card>
        </Section>
      )}

      <Section
        title="Your Google data"
        footer={
          <>
            Calendar: read to plan around your events; events are only added or removed when you accept or delete them here. Drive: only
            the files this app creates. Nothing is sold or used to train AI.{" "}
            <a href="/privacy" className="font-semibold text-blue">Privacy policy</a> ·{" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="font-semibold text-blue">
              Revoke access
            </a>
          </>
        }
      >
        <></>
      </Section>

      <Section title="Claude usage" footer="Estimated from each model's list price; your Anthropic console has the exact bill.">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Last hour", hour],
            ["Last 30 days", month],
          ].map(([label, u]) => {
            const x = u as typeof hour;
            return (
              <Card key={label as string} className="p-4">
                <p className="text-[13px] text-label-2">{label as string}</p>
                <p className="text-[24px] font-semibold">${x.cost.toFixed(2)}</p>
                <p className="text-[12px] text-label-2">
                  {x.n} requests · {(x.input / 1000).toFixed(1)}k in · {(x.output / 1000).toFixed(1)}k out
                </p>
              </Card>
            );
          })}
        </div>
      </Section>

      {connected && (
        <Section title="Calendars" footer="The planner works around events in the calendars you tick.">
          {calendarError ? (
            <Notice tone="red">{calendarError}</Notice>
          ) : (
            <Card className="p-4">
              <form action={saveCalendarSettings} className="flex flex-col gap-4">
                <fieldset className="space-y-2">
                  <legend className="mb-1 text-[13px] font-medium text-label-2">Read events from</legend>
                  {calendars.map((c) => (
                    <label key={c.id} className="flex items-center gap-2.5 text-[15px]">
                      <input
                        type="checkbox"
                        name="calendarIds"
                        value={c.id}
                        defaultChecked={settings.calendarIds.length === 0 || settings.calendarIds.includes(c.id)}
                        className="size-4 accent-[var(--blue)]"
                      />
                      <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </label>
                  ))}
                </fieldset>
                <Submit className="self-end">Save calendars</Submit>
              </form>
            </Card>
          )}
        </Section>
      )}

      {connected && !calendarError && (
        <Section
          title="Calendar sync"
          footer={`School classes, gym days with a set time, tutoring, accepted plan blocks and task due dates go to your “${HUB_CALENDAR_NAME}” Google calendar, so they're on your phone. Moving, renaming or deleting them there updates the hub too.`}
        >
          <Card className="p-4">
            <CalendarSyncForm
              enabled={settings.calendarSync}
              schoolYearEnd={settings.schoolYearEnd}
              hasCalendar={calendars.some((c) => c.name.trim().toLowerCase() === HUB_CALENDAR_NAME.toLowerCase())}
              lastSync={(await lastSyncInfo(user.id)).at}
            />
          </Card>
        </Section>
      )}

      <Section
        title="Google Maps"
        footer="With your own Google Maps key, travel times come from real addresses, Today shows your route on a map, and “Leave by” uses live traffic and transit times. Addresses stay private to you."
      >
        <Card className="flex flex-col gap-5 p-4">
          <MapsKeyForm isSet={mapsOn} />
          {mapsOn && (
            <AddressList
              names={places.filter((p) => p !== "online" && p !== "any")}
              saved={Object.fromEntries(savedPlaces.map((p) => [p.name, p.address]))}
              travelMode={settings.travelMode}
              gymExtraMinutes={settings.gymExtraMinutes}
              modes={TRAVEL_MODES}
            />
          )}
        </Card>
      </Section>

      <Section
        title="Travel times"
        footer="Minutes to get from one place to another. Gym → anywhere includes showering and changing. Online sessions happen wherever you are. The planner never puts two things closer together than this, and Today warns you if fixed sessions are too close. Clear a row's minutes to remove it."
      >
        <Card className="p-4">
          <form action={saveTravel} className="space-y-2">
            <datalist id="places">
              {places.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-2 px-1 text-[12px] font-medium text-label-2">
              <span>From</span>
              <span>To</span>
              <span>Minutes</span>
            </div>
            {[...Object.entries(settings.travel), ["", 0] as const].map(([key, min], i) => {
              const [from, to] = key ? key.split(">") : ["", ""];
              return (
                <div key={key || `new-${i}`} className="grid grid-cols-[1fr_1fr_88px] gap-2">
                  <input name="from" list="places" defaultValue={from} placeholder={key ? undefined : "Add: from…"} aria-label="From" className="field" />
                  <input name="to" list="places" defaultValue={to} placeholder={key ? undefined : "to…"} aria-label="To" className="field" />
                  <input name="minutes" type="number" min={0} max={600} defaultValue={key ? min : ""} aria-label="Minutes" className="field" />
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <Submit>Save travel times</Submit>
            </div>
          </form>
        </Card>
      </Section>

      <Section title="Planner">
        <Card className="p-4">
          <form action={savePlannerSettings} className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" hint="Used in the Home greeting.">
              <input name="displayName" maxLength={40} defaultValue={settings.displayName} className="field" />
            </Field>
            <Field label="Day starts">
              <input type="time" name="dayStart" required defaultValue={settings.dayStart} className="field" />
            </Field>
            <Field label="Day ends">
              <input type="time" name="dayEnd" required defaultValue={settings.dayEnd} className="field" />
            </Field>
            <Field label="Days without school start" hint="Weekends and holidays: nothing is suggested before this.">
              <input type="time" name="freeDayStart" required defaultValue={settings.freeDayStart} className="field" />
            </Field>
            <Field label="Class length (min)">
              <input type="number" name="classMinutes" min={20} max={120} required defaultValue={settings.classMinutes} className="field" />
            </Field>
            <Field label="Break length (min)">
              <input type="number" name="breakMinutes" min={0} max={60} required defaultValue={settings.breakMinutes} className="field" />
            </Field>
            <Field label="Time zone">
              <input name="timezone" required defaultValue={settings.timezone} className="field" />
            </Field>
            <div className="flex items-end justify-end">
              <Submit>Save planner</Submit>
            </div>
          </form>
        </Card>
      </Section>

      <form action="/api/auth/logout" method="post" className="mb-8">
        <button className={buttonClass("destructive")}>
          <LogOut size={16} /> Sign out
        </button>
      </form>

      {user.role !== "owner" && (
        <Section title="Delete account" footer="Deletes everything you stored in Personal Hub and disconnects your Google account. Files in your Google Drive and events in your calendar stay yours.">
          <Card className="p-4">
            <DeleteAccountForm email={user.email} />
          </Card>
        </Section>
      )}
    </div>
  );
}
