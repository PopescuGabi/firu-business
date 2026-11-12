import { APP_NAME, GOOGLE_NAME, pickHubCalendar } from "@/lib/brand";
import { and, eq, gte, sql } from "drizzle-orm";
import { ArrowDown, ArrowUp, BarChart3, CalendarDays, FolderOpen, LogOut, Mail, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { iconFor } from "@/components/custom/icons";
import { PageAdders } from "@/components/page-adders";
import { todayIn } from "@/lib/week";
import { movePage } from "@/app/actions/custom-pages";
import { listPages } from "@/lib/custom-pages-db";
import { AllowanceForm, AnthropicKeyForm, DeleteAccountForm, InviteForm, RemoveMember, WithdrawInvite } from "@/components/account-forms";
import { BackgroundPicker } from "@/components/background-picker";
import { AddressList, MapsKeyForm } from "@/components/maps-settings";
import { SectionsForm } from "@/components/sections-form";
import { CalendarSyncForm } from "@/components/calendar-sync-form";
import { KeyForm } from "@/components/key-form";
import { SpeechForm } from "@/components/speech-form";
import { DEFAULT_VOICE_ID, speechKey } from "@/lib/speech";
import { VercelEnvForm } from "@/components/vercel-env-form";
import { Submit } from "@/components/submit";
import { SettingsNav } from "@/components/settings-nav";
import { buttonClass, Card, Field, List, Notice, PageHeader, Row, Section } from "@/components/ui";
import { saveCalendarSettings, savePlannerSettings, saveTravel } from "@/app/actions/settings";
import { claudeAvailable, MODELS, monthSpend, PRICES } from "@/lib/ai/claude";
import { instagramConfigured } from "@/lib/instagram/api";
import { usd } from "@/lib/ai/allowance";
import { requireUser } from "@/lib/auth";
import { photoVersion } from "@/lib/background";
import { mapsAvailable, TRAVEL_MODES } from "@/lib/google/maps";
import { listPlaces } from "@/lib/places";
import { lastSyncInfo } from "@/lib/calendar-sync";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { listCalendars, type CalendarInfo } from "@/lib/google/calendar";
import { DRIVE_ROOT_NAME, folderUrl } from "@/lib/google/drive";
import { GMAIL_SCOPES, getGoogleAccount, GOOGLE_SCOPES, hasScope } from "@/lib/google/oauth";
import { aiAllowanceUsd, listMembers } from "@/lib/users";
import { canEditLocalEnv, LOCAL_KEYS, type LocalKey } from "@/lib/local-env";
import { getSetting, getSettings } from "@/lib/settings";

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
  const owner = user.role === "owner";
  const myPages = await listPages(user.id);
  const members = owner ? await listMembers() : null;
  const allowance = await aiAllowanceUsd();
  // Everyone shares the owner's key: members see what's left of their monthly allowance; the owner sees each member's spend.
  const spentThisMonth = owner ? 0 : await monthSpend(user.id);
  const memberSpend = new Map(members ? await Promise.all(members.users.filter((m) => m.role !== "owner").map(async (m) => [m.id, await monthSpend(m.id)] as const)) : []);
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

  const places = [...new Set(["home", "online", ...savedPlaces.map((p) => p.name), ...Object.keys(settings.travel).flatMap((k) => k.split(">"))])];

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
    <div className="mx-auto max-w-[1180px]">
      <PageHeader title="Settings" />
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      <SettingsNav />
      <div data-settings>

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
              <p className="flex-1 font-medium">Drive folder “{DRIVE_ROOT_NAME}”</p>
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
                  ? `Opus 5.5 for content · Sonnet 5.5 for analysis and the AI setup · Haiku 5.5 for planning, email and finance · max ${env.aiMaxPerHour()} requests/hour${owner ? (me?.key ? " · your key, shared with your hub" : "") : ` · ${usd(spentThisMonth)} of ${usd(allowance)} used this month`}`
                  : owner
                    ? "Copy-paste mode (Claude app). Add your API key below to use Claude inside the site, for everyone in your hub."
                    : "Copy-paste mode (Claude app) until the hub's owner adds a key."}
              </p>
            </div>
          </Row>
        </List>
        {missingScopes.length > 0 && (
          <Notice tone="orange">Some Google permissions are missing. Tap Reconnect and allow Calendar and Drive.</Notice>
        )}
      </Section>

      <Section
        title="Sections"
        className="scroll-mt-6"
        footer="Turned-off sections disappear from the sidebar and Home; their data stays."
        action={
          <Link href="/setup" className={buttonClass("tinted", "sm")}>
            <Wand2 size={14} /> Set up with AI
          </Link>
        }
      >
        <div id="sections">
          <SectionsForm initial={user.modules} b2b={settings.business.b2b} />
        </div>
      </Section>

      <Section title="Add pages" footer="Ready-made pages for your kind of job, or one you build yourself. Adding pages never changes the ones you have.">
        <PageAdders today={todayIn(settings.timezone)} existing={myPages.map((p) => p.title)} />
      </Section>

      {myPages.length > 0 && (
        <Section title="Your pages" footer="Pages built for your work. Open one to add entries; its ⚙︎ button renames or deletes it.">
          <List>
            {myPages.map((p, i) => {
              const Icon = iconFor(p.icon);
              return (
                <Row key={p.id}>
                  <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: p.color }}>
                    <Icon size={17} />
                  </span>
                  <Link href={`/p/${p.slug}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    {p.description && <p className="truncate text-[13px] text-label-2">{p.description}</p>}
                  </Link>
                  <form action={movePage.bind(null, p.id, -1)}>
                    <button disabled={i === 0} aria-label={`Move ${p.title} up`} className={buttonClass("plain", "sm")}>
                      <ArrowUp size={14} />
                    </button>
                  </form>
                  <form action={movePage.bind(null, p.id, 1)}>
                    <button disabled={i === myPages.length - 1} aria-label={`Move ${p.title} down`} className={buttonClass("plain", "sm")}>
                      <ArrowDown size={14} />
                    </button>
                  </form>
                </Row>
              );
            })}
          </List>
        </Section>
      )}

      <Section title="Appearance" footer="Auto follows your device's light or dark mode. Your own photo stays private to you. Browsers can't read your desktop wallpaper directly, so “Use my wallpaper” opens your Pictures folder to pick its file.">
        <Card className="p-4">
          <BackgroundPicker current={settings.background} theme={settings.theme} sounds={settings.sounds} photoUrl={photo ? `/api/background?v=${photo}` : null} />
        </Card>
      </Section>

      {owner && (
        <Section title="Jarvis voice" footer="ElevenLabs gives Jarvis a natural human voice and accurate hearing in Romanian and English. Billed to your ElevenLabs plan; a Starter or Creator plan covers daily use.">
          <Card className="p-4">
            <SpeechForm isSet={Boolean(await speechKey())} voice={(await getSetting<string>(user.id, "jarvisVoiceId")) ?? ""} defaultVoice={DEFAULT_VOICE_ID} />
          </Card>
        </Section>
      )}

      {owner && (
        <Section title="Anthropic key" footer="One key for the whole hub: members use Claude on it within their monthly allowance (Members below).">
          <Card className="p-4">
            <AnthropicKeyForm isSet={Boolean(me?.key)} />
          </Card>
        </Section>
      )}

      {owner && (
        <Section title="Instagram (Meta app)" className="scroll-mt-6" footer="One Meta app for the whole hub. Until Meta approves it (App Review), only accounts added as Instagram testers on the app can connect.">
          <div id="instagram">
            <List>
              <Row>
                <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-purple to-pink text-white">
                  <BarChart3 size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Instagram API with Instagram Login</p>
                  <p className="text-[13px] text-label-2">
                    {instagramConfigured() ? "Set up: INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are present." : "Not set up yet: add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to Vercel (see the guide)."}
                    {!process.env.CRON_SECRET && " Daily updates also need CRON_SECRET."}
                  </p>
                  <p className="mt-1 truncate font-mono text-[12px] text-label-3">Redirect URL: {env.appUrl()}/api/instagram/callback</p>
                </div>
                <a href="https://github.com/PopescuGabi/firu-business/blob/main/docs/instagram-setup.md" target="_blank" rel="noreferrer" className={buttonClass("gray", "sm")}>
                  Guide
                </a>
              </Row>
            </List>
          </div>
        </Section>
      )}

      {members && (
        <Section title="Members" footer={`${APP_NAME} is invite only: people sign in with the Google account you invite. Each person only sees their own data.`}>
          <Card className="flex flex-col gap-4 p-4">
            <InviteForm />
            <AllowanceForm usd={allowance} />
            <List className="!shadow-none">
              {members.users.map((m) => (
                <Row key={m.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name || m.email}</p>
                    <p className="truncate text-[13px] text-label-2">
                      {m.email} · {m.role === "owner" ? "Owner" : m.onboarded ? "Member" : "Invited, setting up"}
                      {m.role !== "owner" && ` · AI ${usd(memberSpend.get(m.id) ?? 0)} of ${usd(allowance)} this month`}
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
          footer={`Accepted plan blocks and task due dates go to your “${GOOGLE_NAME}” Google calendar, so they're on your phone. Moving, renaming or deleting them there updates the app too.`}
        >
          <Card className="p-4">
            <CalendarSyncForm
              enabled={settings.calendarSync}
              calendarName={pickHubCalendar(calendars)?.name.trim() ?? null}
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
              modes={TRAVEL_MODES}
            />
          )}
        </Card>
      </Section>

      <Section
        title="Travel times"
        footer="Minutes to get from one place to another (e.g. home → a client's office). Online meetings happen wherever you are. The planner never puts two things closer together than this, and Today warns you if fixed meetings are too close. Clear a row's minutes to remove it."
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
        <Section title="Delete account" footer={`Deletes everything you stored in ${APP_NAME} and disconnects your Google account. Files in your Google Drive and events in your calendar stay yours.`}>
          <Card className="p-4">
            <DeleteAccountForm email={user.email} />
          </Card>
        </Section>
      )}
      </div>
      </div>
    </div>
  );
}
