import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Clapperboard, ExternalLink, Image as ImageIcon, Layers, Sparkles } from "lucide-react";
import { compact } from "@/lib/chart-scale";
import { fmt, KIND_LABEL, type Dashboard, type Kpi } from "@/lib/instagram/stats";
import { Bars, CHART_COLORS, ComboChart, Heatmap, LineChart, PostingCalendar } from "../charts";
import { SegmentedLinks } from "../motion";
import { Card } from "../ui";

export type DashQuery = { range: "7" | "30" | "90" | "custom"; from: string; to: string; kind: "all" | "reel" | "carousel" | "photo"; sort: "date" | "reach" | "views" | "engagement" };
export type DashAccount = { username: string; name: string; picture: string | null; demo?: boolean; lastSyncAt?: Date | null; status?: string; lastError?: string | null };

const KIND_COLORS: Record<string, string> = { reel: CHART_COLORS[0], carousel: CHART_COLORS[2], photo: CHART_COLORS[3], video: CHART_COLORS[1] };
const KIND_ICON = { reel: Clapperboard, carousel: Layers, photo: ImageIcon, video: Clapperboard } as const;
const shortDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (v: number | null) => (v === null ? "–" : `${v.toFixed(v >= 10 ? 1 : 2)}%`);
const val = (k: Kpi) => (k.value === null ? null : k.format === "pct" ? pct(k.value) : fmt(k.value));

function Delta({ change, invert = false }: { change: number | null; invert?: boolean }) {
  if (change === null) return <span className="text-[12px] text-label-3">no earlier data</span>;
  const good = invert ? change <= 0 : change >= 0;
  const Icon = change >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums", good ? "text-green" : "text-red")}>
      <Icon size={13} />
      {Math.abs(change) >= 1000 ? ">999" : Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%
    </span>
  );
}

function KpiCard({ k, big }: { k: Kpi; big?: boolean }) {
  const v = val(k);
  return (
    <div className={clsx("glass flex flex-col justify-between gap-2 rounded-[22px] p-3.5", big && "sm:p-4")} title={k.note}>
      <p className="text-[12px] font-medium text-label-2">{k.label}</p>
      {v === null ? (
        <p className="text-[13px] leading-snug text-label-3">Not available from Instagram</p>
      ) : (
        <>
          <p className={clsx("leading-none font-bold tracking-tight tabular-nums", big ? "text-[30px]" : "text-[22px]")}>{v}</p>
          <Delta change={k.change} invert={k.key === "unfollows"} />
        </>
      )}
    </div>
  );
}

function Thumb({ thumbnail, kind, caption }: { thumbnail: string | null; kind: string; caption: string }) {
  const Icon = KIND_ICON[kind as keyof typeof KIND_ICON] ?? ImageIcon;
  return thumbnail ? (
    // Instagram's image links expire; they're refreshed on every sync.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbnail} alt={caption.slice(0, 80) || "Post"} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
  ) : (
    <div className="grid size-full place-items-center text-white" style={{ background: `linear-gradient(135deg, ${KIND_COLORS[kind] ?? CHART_COLORS[0]}, #1c1c28)` }}>
      <Icon size={22} />
    </div>
  );
}

/**
 * The Instagram dashboard: 30-second summary, KPIs vs the previous period, trends, posting rhythm,
 * formats, top posts and every post. `href(q)` builds a link with changed filters.
 */
export function InstagramDashboard({ data, account, query, href, actions }: { data: Dashboard; account: DashAccount; query: DashQuery; href: (q: Partial<DashQuery>) => string; actions?: React.ReactNode }) {
  const k = (key: string) => data.kpis.find((x) => x.key === key)!;
  const trim = (dates: string[], values: (number | null)[]) => {
    const idx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    if (!idx.length) return null;
    const a = idx[0];
    const b = idx[idx.length - 1];
    return { labels: dates.slice(a, b + 1).map(shortDate), values: values.slice(a, b + 1).map((v) => v ?? 0) };
  };
  const reach = trim(data.series.dates, data.series.reach);
  const views = trim(data.series.dates, data.series.views);
  const followers = trim(data.series.dates, data.series.followers);
  const followerBase = followers ? (() => {
    const lo = Math.min(...followers.values);
    const hi = Math.max(...followers.values);
    const step = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, hi - lo))) - 1);
    return Math.max(0, Math.floor((lo - (hi - lo) * 0.15) / step) * step);
  })() : 0;
  const sorted = [...data.rows].sort((a, b) =>
    query.sort === "reach" ? (b.metrics.reach ?? -1) - (a.metrics.reach ?? -1) : query.sort === "views" ? (b.metrics.views ?? -1) - (a.metrics.views ?? -1) : query.sort === "engagement" ? (b.engagement ?? -1) - (a.engagement ?? -1) : 0,
  );
  const ranges = [
    { key: "7", label: "7 days" },
    { key: "30", label: "30 days" },
    { key: "90", label: "90 days" },
    { key: "custom", label: "Custom" },
  ];
  const kinds = [
    { key: "all", label: "All" },
    { key: "reel", label: "Reels" },
    { key: "carousel", label: "Carousels" },
    { key: "photo", label: "Photos" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {/* Account + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-10 shrink-0 overflow-hidden rounded-full bg-fill">
            {account.picture && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            )}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-[16px] font-semibold">
              @{account.username}
              {account.demo && (
                <span className="chip" data-tone="orange">
                  DEMO DATA
                </span>
              )}
            </p>
            <p className="truncate text-[12px] text-label-2">
              {account.demo
                ? "Made-up numbers to show the layout. Connect Instagram to see real results."
                : `${account.lastSyncAt ? `Updated ${account.lastSyncAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "First update running…"} · Instagram can be up to 48 h behind`}
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {account.status && account.status !== "ok" && (
        <p role="alert" className="rounded-[14px] bg-red/12 px-3 py-2 text-[13px] text-red">
          {account.status === "expired" ? "The Instagram connection expired. Connect the account again." : `The last update failed: ${account.lastError ?? "unknown error"}`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedLinks label="Period" active={query.range} items={ranges.map((r) => ({ key: r.key, label: r.label, href: href({ range: r.key as DashQuery["range"] }) }))} />
        <div className="flex flex-wrap gap-1">
          {kinds.map((t) => (
            <Link key={t.key} href={href({ kind: t.key })} scroll={false} aria-current={query.kind === t.key ? "true" : undefined} className={clsx("chip", query.kind !== t.key && "opacity-70")} data-tone={query.kind === t.key ? "blue" : undefined}>
              {t.label}
            </Link>
          ))}
        </div>
        {query.range === "custom" && (
          <form className="flex flex-wrap items-center gap-2" method="get">
            {/* Keeps the other filters when picking dates. */}
            {Object.entries(Object.fromEntries(new URL(href({}), "http://x").searchParams)).map(([n, v]) => (n === "from" || n === "to" ? null : <input key={n} type="hidden" name={n} value={v} />))}
            <input type="date" name="from" defaultValue={query.from} aria-label="From" className="field h-8 w-auto py-0 text-[13px]" />
            <span className="text-label-3">–</span>
            <input type="date" name="to" defaultValue={query.to} aria-label="To" className="field h-8 w-auto py-0 text-[13px]" />
            <button className="chip" data-tone="blue">
              Show
            </button>
          </form>
        )}
        <span className="text-[12px] text-label-3">
          {shortDate(data.period.from)} – {shortDate(data.period.to)}
        </span>
      </div>

      {/* In 30 seconds */}
      <Card className="flex flex-col gap-2 p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-label-2 uppercase">
          <Sparkles size={14} className="text-orange" /> In 30 seconds
        </p>
        <ul className="grid gap-1.5 text-[15px] leading-snug sm:grid-cols-2">
          {data.summary.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              {s}
            </li>
          ))}
        </ul>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {["followers", "net", "reach", "views", "interactions", "engagement"].map((key) => (
          <KpiCard key={key} k={k(key)} big />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {["likes", "comments", "shares", "saves", "follows", "unfollows"].map((key) => (
          <KpiCard key={key} k={k(key)} />
        ))}
      </div>

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-[15px] font-semibold">Reach and views</h3>
          {reach || views ? (
            <LineChart
              labels={(reach ?? views)!.labels}
              series={[...(reach ? [{ label: "Reach", values: reach.values }] : []), ...(views ? [{ label: "Views", values: views.values, color: CHART_COLORS[3] }] : [])]}
            />
          ) : (
            <p className="text-[14px] text-label-3">No daily numbers for this period yet.</p>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-1 text-[15px] font-semibold">Followers</h3>
          <p className="mb-3 text-[12px] text-label-3">{data.followersSince ? `Saved daily since ${shortDate(data.followersSince)}; Instagram keeps no history.` : "Saved daily from the day the account connects."}</p>
          {followers && followers.values.length > 1 ? (
            // Zoomed to the real range (from just under the lowest count), so growth is visible.
            <LineChart labels={followers.labels} series={[{ label: "Followers", values: followers.values.map((v) => v - followerBase), color: CHART_COLORS[1] }]} format={(t) => compact(t + followerBase)} />
          ) : (
            <p className="text-[14px] text-label-3">The line starts after a second day.</p>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-[15px] font-semibold">Posts per week vs reach</h3>
          <ComboChart labels={data.weekly.weeks.map(shortDate)} bars={{ label: "Posts", values: data.weekly.posts }} line={{ label: "Reach that week", values: data.weekly.reach }} />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-[15px] font-semibold">Posting calendar</h3>
          <PostingCalendar days={data.calendar.slice(-42)} colors={KIND_COLORS} labels={{ reel: "Reel", carousel: "Carousel", photo: "Photo", video: "Video" }} />
          {data.calendar.length > 42 && <p className="mt-2 text-[12px] text-label-3">Showing the last 6 weeks of the period.</p>}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-1 text-[15px] font-semibold">When posts do best</h3>
        <p className="mb-3 text-[12px] text-label-3">Average reach of posts by the day and hour they went out. Empty squares: no posts then.</p>
        <Heatmap cells={data.heat} />
      </Card>

      {/* Formats */}
      <Card className="p-4">
        <h3 className="mb-3 text-[15px] font-semibold">Reels vs carousels vs photos (per post)</h3>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Bars labels={data.formats.map((f) => f.label)} series={[{ label: "Average reach", values: data.formats.map((f) => f.reach ?? 0) }, { label: "Average views", values: data.formats.map((f) => f.views ?? 0), color: CHART_COLORS[3] }]} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px] tabular-nums">
              <thead className="text-left text-[11px] text-label-2 uppercase">
                <tr>
                  <th className="py-1.5 font-semibold">Format</th>
                  <th className="font-semibold">Posts</th>
                  <th className="font-semibold">Reach</th>
                  <th className="font-semibold">Views</th>
                  <th className="font-semibold">Engagement</th>
                  <th className="font-semibold">Shares + saves</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {data.formats.map((f) => (
                  <tr key={f.kind}>
                    <td className="py-2 font-medium">
                      <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: KIND_COLORS[f.kind] }} />
                      {f.label}
                    </td>
                    <td>{f.posts}</td>
                    <td>{f.reach === null ? "–" : compact(f.reach)}</td>
                    <td>{f.views === null ? "–" : compact(f.views)}</td>
                    <td>{pct(f.engagement)}</td>
                    <td>{f.sharesSaves === null ? "–" : f.sharesSaves.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Top 5 */}
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-[15px] font-semibold">Top 5 posts by reach</h3>
        {data.top.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {data.top.map((p, i) => (
              <a key={p.mediaId} href={p.permalink || undefined} target="_blank" rel="noreferrer" className="glass group flex flex-col overflow-hidden rounded-[20px]">
                <div className="relative aspect-[4/5] overflow-hidden bg-fill">
                  <Thumb thumbnail={p.thumbnail} kind={p.kind} caption={p.caption} />
                  <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-black/55 text-[12px] font-bold text-white">{i + 1}</span>
                  <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{KIND_LABEL[p.kind].replace(/s$/, "")}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5 text-[12px]">
                  <p className="truncate font-medium text-label">{p.caption || "No caption"}</p>
                  <p className="text-label-2 tabular-nums">
                    {p.metrics.reach === null ? "–" : compact(p.metrics.reach)} reach · {pct(p.engagement)}
                  </p>
                  <p className="text-label-3">{shortDate(p.postedAt)}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <Card className="p-4 text-[14px] text-label-3">No posts in this period.</Card>
        )}
      </section>

      {/* All posts */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-[15px] font-semibold">All posts ({data.rows.length})</h3>
          <span className="text-[12px] text-label-2">Sort by</span>
          {(["date", "reach", "views", "engagement"] as const).map((s) => (
            <Link key={s} href={href({ sort: s })} scroll={false} className="chip" data-tone={query.sort === s ? "blue" : undefined}>
              {s === "date" ? "Date" : s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px] tabular-nums">
            <thead className="text-left text-[11px] text-label-2 uppercase">
              <tr>
                <th className="py-1.5 font-semibold">Post</th>
                <th className="font-semibold">Date</th>
                <th className="font-semibold">Type</th>
                <th className="font-semibold">Views</th>
                <th className="font-semibold">Reach</th>
                <th className="font-semibold">Likes</th>
                <th className="font-semibold">Comments</th>
                <th className="font-semibold">Shares</th>
                <th className="font-semibold">Saves</th>
                <th className="font-semibold">Engagement</th>
                <th className="font-semibold" title="Instagram gives this for posts and carousels, not Reels">New followers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {sorted.slice(0, 100).map((p) => {
                const n = (v: number | null) => (v === null ? <span className="text-label-3">–</span> : compact(v));
                return (
                  <tr key={p.mediaId}>
                    <td className="py-1.5 pr-2">
                      <a href={p.permalink || undefined} target="_blank" rel="noreferrer" className="flex max-w-[240px] items-center gap-2">
                        <span className="size-9 shrink-0 overflow-hidden rounded-[8px]">
                          <Thumb thumbnail={p.thumbnail} kind={p.kind} caption={p.caption} />
                        </span>
                        <span className="truncate">{p.caption || "No caption"}</span>
                        {p.permalink && <ExternalLink size={12} className="shrink-0 text-label-3" />}
                      </a>
                    </td>
                    <td>{shortDate(p.postedAt)}</td>
                    <td>{KIND_LABEL[p.kind].replace(/s$/, "")}</td>
                    <td>{n(p.metrics.views)}</td>
                    <td>{n(p.metrics.reach)}</td>
                    <td>{n(p.metrics.likes)}</td>
                    <td>{n(p.metrics.comments)}</td>
                    <td>{n(p.metrics.shares)}</td>
                    <td>{n(p.metrics.saves)}</td>
                    <td>{pct(p.engagement)}</td>
                    <td>{n(p.metrics.follows)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length > 100 && <p className="mt-2 text-[12px] text-label-3">Showing 100 of {sorted.length}. Pick a shorter period to see the rest.</p>}
        </div>
      </Card>
      <p className="px-1 text-[12px] text-label-3">
        Numbers come from Instagram&apos;s official API. Reach is added up per day; engagement is interactions ÷ reach. Anything Instagram doesn&apos;t provide shows as “Not available”, never estimated.
      </p>
    </div>
  );
}
