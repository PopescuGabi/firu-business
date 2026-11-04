import Link from "next/link";
import { BarChart3, ExternalLink, Pencil, Plus, RefreshCw, Target, Trash2 } from "lucide-react";
import { addPostStats, deleteGoal, deletePost, logPost, saveGoal, updatePost } from "@/app/actions/marketing";
import { compact } from "@/lib/chart-scale";
import { fmtDate } from "@/lib/time";
import { engagement, GOAL_METRICS, goalProgress, kindLabel, loadGoals, loadPosts, needsNumbers, PLATFORMS, platformLabel, POST_KINDS, summarize, type PostRow } from "@/lib/marketing";
import { formatMoney, type Currency } from "@/lib/fx-math";
import { Bars, Heatmap, LineChart, Meter } from "./charts";
import { CountUp } from "./count-up";
import { MarketingAi } from "./marketing-ai";
import { Sheet } from "./sheet";
import { DeleteFooter, Submit } from "./submit";
import { buttonClass, Card, Empty, Field } from "./ui";

type Client = { id: number; name: string; color: string };
type Prefill = Partial<Pick<PostRow, "title" | "kind" | "clientId" | "reelId" | "carouselId" | "postedOn">>;

const pct = (n: number) => `${n.toFixed(1)}%`;

function PostForm({ action, clients, post, prefill, today, submitLabel = "Log post" }: { action: (fd: FormData) => Promise<void>; clients: Client[]; post?: PostRow; prefill?: Prefill; today: string; submitLabel?: string }) {
  const v = { ...prefill, ...post };
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Title">
        <input name="title" required maxLength={200} defaultValue={v.title ?? ""} className="field" placeholder="e.g. Album unboxing reel" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <select name="platform" defaultValue={post?.platform ?? "instagram"} className="field">
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select name="kind" defaultValue={v.kind ?? "reel"} className="field">
            {POST_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Posted on">
          <input name="postedOn" type="date" required defaultValue={v.postedOn ?? today} className="field" />
        </Field>
        <Field label="At" hint="For the best-time chart.">
          <input name="postedAt" type="time" defaultValue={post?.postedAt ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Client">
        <select name="clientId" defaultValue={v.clientId ?? ""} className="field">
          <option value="">My own</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Link (optional)">
        <input name="url" type="url" maxLength={500} defaultValue={post?.url ?? ""} className="field" placeholder="https://" />
      </Field>
      {v.reelId && <input type="hidden" name="reelId" value={v.reelId} />}
      {v.carouselId && <input type="hidden" name="carouselId" value={v.carouselId} />}
      {!post && <StatFields />}
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}

function StatFields({ stats }: { stats?: PostRow["stats"] }) {
  const f = (name: keyof PostRow["stats"], label: string) => (
    <Field label={label}>
      <input name={name} type="number" min={0} inputMode="numeric" defaultValue={stats?.[name] || ""} className="field" />
    </Field>
  );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {f("views", "Views")}
      {f("likes", "Likes")}
      {f("comments", "Comments")}
      {f("shares", "Shares")}
      {f("saves", "Saves")}
      {f("follows", "New followers")}
    </div>
  );
}

function Tile({ label, value, sub, format }: { label: string; value: number; sub: React.ReactNode; format?: "pct" }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-[13px] font-medium text-label-2">{label}</p>
      <p className="text-[30px] leading-none font-bold tracking-tight tabular-nums">{format === "pct" ? pct(value) : <CountUp value={Math.round(value)} />}</p>
      <p className="truncate text-[12px] text-label-2">{sub}</p>
    </Card>
  );
}

const change = (now: number, before: number) => (before ? `${now >= before ? "▲" : "▼"} ${Math.abs(Math.round(((now - before) / before) * 100))}% vs last month` : "First month with numbers");

/**
 * Clients → Marketing (all clients) or a client's Marketing tab: log posts and their numbers, see how
 * they do, track goals, and ask Claude what to do next.
 */
export async function MarketingView({
  uid,
  clients,
  clientId,
  today,
  currency,
  incomeThisMonth = 0,
}: {
  uid: number;
  clients: Client[];
  clientId?: number;
  today: string;
  currency: Currency;
  incomeThisMonth?: number;
}) {
  const [posts, todo, goals] = await Promise.all([loadPosts(uid, clientId), needsNumbers(uid, clientId), loadGoals(uid, clientId)]);
  const s = summarize(posts, today);
  const name = (id: number | null) => clients.find((c) => c.id === id);
  const goalShown = (g: (typeof goals)[number]) =>
    g.metric === "engagement" ? `${(goalProgress(g, posts, today) / 10).toFixed(1)}% of ${(g.target / 10).toFixed(1)}%` : g.metric === "income" ? `${formatMoney(incomeThisMonth, currency, { compact: true })} of ${formatMoney(g.target * 100, currency, { compact: true })}` : `${compact(goalProgress(g, posts, today))} of ${compact(g.target)}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Sheet title="Log a post" trigger={<><Plus size={16} /> Log a post</>} triggerClassName={buttonClass("filled")}>
          <PostForm action={logPost} clients={clients} prefill={{ clientId: clientId ?? null }} today={today} />
        </Sheet>
        <Sheet title="New goal" trigger={<><Target size={15} /> Add goal</>} triggerClassName={buttonClass("gray")}>
          <GoalForm clientId={clientId} />
        </Sheet>
        <div className="ml-auto">
          <MarketingAi clientId={clientId} hasPosts={posts.length > 0} />
        </div>
      </div>

      {todo.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-[13px] font-semibold text-label-2">Needs numbers · marked Posted, not logged yet</p>
          <ul className="flex flex-wrap gap-2">
            {todo.map((t) => (
              <li key={`${t.kind}${t.id}`}>
                <Sheet title={`Log “${t.title}”`} trigger={<><Plus size={13} /> {t.title}</>} triggerClassName={buttonClass("tinted", "sm")}>
                  <PostForm
                    action={logPost}
                    clients={clients}
                    today={today}
                    prefill={{ title: t.title, kind: t.kind, clientId: t.clientId, postedOn: t.postDate ?? today, ...(t.kind === "reel" ? { reelId: t.id } : { carouselId: t.id }) }}
                  />
                </Sheet>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {posts.length === 0 ? (
        <Empty icon={<BarChart3 size={36} />} title="No posts logged yet">
          Log each post you publish with its views, likes, comments, shares and saves. The charts and Claude&apos;s advice build on them.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Views this month" value={s.month.views} sub={change(s.month.views, s.lastMonth.views)} />
            <Tile label="Engagement" value={s.engagement} format="pct" sub="Likes, comments, shares and saves per view" />
            <Tile label="Posts this month" value={s.postsThisMonth} sub={`${posts.length} logged in total`} />
            <Tile label="New followers" value={s.month.follows} sub={change(s.month.follows, s.lastMonth.follows)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <p className="mb-3 text-[15px] font-semibold">Views per week</p>
              <LineChart labels={s.weeks.map((w) => fmtDate(w, { day: "numeric", month: "short" }))} series={[{ label: "Views", values: s.weekly }]} />
            </Card>
            <Card className="p-4">
              <p className="mb-3 text-[15px] font-semibold">Best time to post</p>
              <Heatmap cells={s.heat} />
              <p className="mt-2 text-[12px] text-label-2">Average views by the day and hour posts went out (add the time when you log a post).</p>
            </Card>
            <Card className="p-4">
              <p className="mb-3 text-[15px] font-semibold">Average views by type</p>
              <Bars labels={s.byKind.map((k) => k.label)} series={[{ label: "Avg views", values: s.byKind.map((k) => Math.round(k.avgViews)) }]} />
            </Card>
            <Card className="p-4">
              <p className="mb-3 text-[15px] font-semibold">Engagement by platform</p>
              <Bars labels={s.byPlatform.map((p) => p.label)} series={[{ label: "Engagement %", values: s.byPlatform.map((p) => Math.round(p.engagement * 10) / 10) }]} format={(n) => `${n}%`} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <p className="mb-2 text-[15px] font-semibold">Best posts</p>
              <PostMini rows={s.best} name={name} />
            </Card>
            {s.worst.length > 0 && (
              <Card className="p-4">
                <p className="mb-2 text-[15px] font-semibold">Lowest posts</p>
                <PostMini rows={s.worst} name={name} />
              </Card>
            )}
          </div>

          {!clientId && clients.length > 1 && (
            <Card className="p-4">
              <p className="mb-3 text-[15px] font-semibold">By client</p>
              <Bars
                labels={clients.map((c) => c.name)}
                series={[{ label: "Views", values: clients.map((c) => posts.filter((p) => p.clientId === c.id).reduce((n, p) => n + p.stats.views, 0)) }]}
              />
            </Card>
          )}
        </>
      )}

      {goals.length > 0 && (
        <Card className="flex flex-col gap-4 p-4">
          <p className="text-[15px] font-semibold">Goals</p>
          {goals.map((g) => {
            const value = g.metric === "income" ? incomeThisMonth / 100 : goalProgress(g, posts, today);
            return (
              <div key={g.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Meter label={`${GOAL_METRICS.find((m) => m.key === g.metric)?.label} this ${g.period}`} value={value} target={g.target} display={goalShown(g)} />
                </div>
                <form action={deleteGoal.bind(null, g.id)}>
                  <button aria-label="Remove goal" className="cursor-pointer rounded-full p-1.5 text-label-3 hover:bg-fill hover:text-red" data-sfx="remove">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            );
          })}
        </Card>
      )}

      {posts.length > 0 && (
        <Card className="divide-y divide-separator">
          {posts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.title}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex align-middle text-label-3 hover:text-accent" aria-label="Open post">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </p>
                <p className="text-[12px] text-label-2">
                  {platformLabel(p.platform)} · {kindLabel(p.kind)} · {fmtDate(p.postedOn, { day: "numeric", month: "short" })}
                  {p.postedAt && ` ${p.postedAt}`}
                  {name(p.clientId) && ` · ${name(p.clientId)!.name}`}
                </p>
              </div>
              <div className="flex gap-4 text-right text-[13px] tabular-nums">
                <span>
                  <strong>{compact(p.stats.views)}</strong> <span className="text-label-2">views</span>
                </span>
                <span>
                  <strong>{pct(engagement(p.stats))}</strong> <span className="text-label-2">eng.</span>
                </span>
              </div>
              <div className="flex gap-1">
                <Sheet title={`Numbers for “${p.title}”`} trigger={<RefreshCw size={15} />} triggerLabel="Update numbers" triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill">
                  <form action={addPostStats.bind(null, p.id)} className="flex flex-col gap-4">
                    <p className="text-[13px] text-label-2">Today&apos;s totals from the app. Earlier numbers are kept, so growth shows over time.</p>
                    <StatFields stats={p.stats} />
                    <Submit className="self-end">Save numbers</Submit>
                  </form>
                </Sheet>
                <Sheet title="Edit post" trigger={<Pencil size={15} />} triggerLabel={`Edit ${p.title}`} triggerClassName="cursor-pointer rounded-full p-2 text-label-2 hover:bg-fill">
                  <PostForm action={updatePost.bind(null, p.id)} clients={clients} post={p} today={today} submitLabel="Save" />
                  <DeleteFooter action={deletePost.bind(null, p.id)} message={`Delete “${p.title}” and its numbers?`}>
                    <Trash2 size={15} /> Delete post
                  </DeleteFooter>
                </Sheet>
              </div>
            </div>
          ))}
        </Card>
      )}
      {clientId && (
        <p className="px-1 text-[13px] text-label-2">
          All clients together: <Link href="/clients?view=marketing" className="font-semibold text-accent">Clients → Marketing</Link>
        </p>
      )}
    </div>
  );
}

function PostMini({ rows, name }: { rows: PostRow[]; name: (id: number | null) => Client | undefined }) {
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 text-[14px]">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fill text-[11px] font-bold">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">
            {p.title}
            <span className="text-label-2">
              {" "}
              · {platformLabel(p.platform)}
              {name(p.clientId) && ` · ${name(p.clientId)!.name}`}
            </span>
          </span>
          <strong className="tabular-nums">{compact(p.stats.views)}</strong>
        </li>
      ))}
    </ol>
  );
}

function GoalForm({ clientId }: { clientId?: number }) {
  return (
    <form action={saveGoal} className="flex flex-col gap-4">
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Goal">
          <select name="metric" className="field" defaultValue="views">
            {GOAL_METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Each">
          <select name="period" className="field" defaultValue="month">
            <option value="month">Month</option>
            <option value="week">Week</option>
          </select>
        </Field>
      </div>
      <Field label="Target" hint="Engagement in %, income in your chart currency.">
        <input name="target" type="number" min={0} step="any" required className="field" placeholder="e.g. 20000" />
      </Field>
      <Submit className="self-end">Add goal</Submit>
    </form>
  );
}
