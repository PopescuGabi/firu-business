import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import clsx from "clsx";
import { Globe, Images, Plus, Share2 } from "lucide-react";
import { NewPortfolioItem, ShareControls } from "@/components/portfolio";
import { Sheet } from "@/components/sheet";
import { Bento, buttonClass, Empty, PageHeader, Pill, spanStyle } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { getGoogleAccount } from "@/lib/google/oauth";
import { coverOf, getShare, PORTFOLIO_TYPES, typeLabel } from "@/lib/portfolio";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Portfolio" };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ type?: string; tag?: string }> }) {
  const { type, tag } = await searchParams;
  const db = await getDb();
  const [items, clients, share, account] = await Promise.all([
    db.select().from(schema.portfolioItems).orderBy(desc(schema.portfolioItems.date), desc(schema.portfolioItems.id)),
    db.select().from(schema.clients).where(eq(schema.clients.archived, false)).orderBy(asc(schema.clients.name)),
    getShare(),
    getGoogleAccount(),
  ]);
  const client = (id: number | null) => clients.find((c) => c.id === id);
  const shown = items.filter((i) => (!type || i.type === type) && (!tag || i.tags.includes(tag)));
  const tags = [...new Set(items.flatMap((i) => i.tags))].sort();
  const types = PORTFOLIO_TYPES.filter(([k]) => items.some((i) => i.type === k));
  const shareUrl = `${env.appUrl()}/share/${share.token}`;
  const href = (p: { type?: string; tag?: string }) => {
    const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
    return `/portfolio${q ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) =>
    clsx("rounded-full px-3 py-1.5 text-[13px] font-medium transition", active ? "bg-ink text-on-ink" : "glass text-label-2 hover:text-label");

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`${items.length} piece${items.length === 1 ? "" : "s"} · ${items.filter((i) => i.public).length} public`}
        actions={
          <>
            <Sheet title="Share your portfolio" trigger={<><Share2 size={16} /> Share</>} triggerClassName={buttonClass("gray")}>
              <ShareControls url={shareUrl} enabled={share.enabled} count={items.filter((i) => i.public).length} />
            </Sheet>
            {account?.accessToken && (
              <Sheet title="New portfolio item" trigger={<><Plus size={16} /> New item</>} triggerClassName={buttonClass("filled")}>
                <NewPortfolioItem clients={clients.map(({ id, name }) => ({ id, name }))} />
              </Sheet>
            )}
          </>
        }
      />

      {items.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href={href({ tag })} className={chip(!type)}>All</Link>
          {types.map(([k, l]) => (
            <Link key={k} href={href({ type: k, tag })} className={chip(type === k)}>{l}</Link>
          ))}
          {tags.length > 0 && <span className="mx-1 w-px self-stretch bg-separator" />}
          {tags.map((t) => (
            <Link key={t} href={href({ type, tag: tag === t ? undefined : t })} className={chip(tag === t)}>#{t}</Link>
          ))}
        </div>
      )}

      {!account?.accessToken ? (
        <Empty icon={<Images size={36} />} title="Connect Google first">Portfolio files are stored in your Google Drive. Connect Google in Settings.</Empty>
      ) : shown.length === 0 ? (
        <Empty icon={<Images size={36} />} title={items.length ? "Nothing matches" : "Your portfolio is empty"}>
          {items.length ? "Try another type or tag." : "Add your best reels, carousels, designs and apps. Upload the files straight from your laptop."}
        </Empty>
      ) : (
        <Bento>
          {shown.map((item, i) => {
            const cover = coverOf(item);
            const c = client(item.clientId);
            // Featured look: the newest piece is wide on bigger screens.
            const span = i === 0 && !type && !tag ? { p: 2, t: 6, l: 8, d: 6, rl: 2, rd: 2 } : { p: 2, t: 3, l: 4, d: 3 };
            return (
              <Link key={item.id} href={`/portfolio/${item.id}`} className="tile glass group flex flex-col overflow-hidden rounded-[24px]" style={spanStyle(span, i)}>
                <div className="relative min-h-44 flex-1 overflow-hidden bg-fill">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/drive/thumb/${cover.id}?s=${i === 0 ? 1400 : 800}`}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-label-3">
                      <Images size={36} />
                    </div>
                  )}
                  {item.public && (
                    <span className="chrome absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold">
                      <Globe size={12} /> Public
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Pill color="var(--accent)">{typeLabel(item.type)}</Pill>
                    {item.date && <span className="text-[12px] text-label-2">{fmtDate(item.date, { month: "short", year: "numeric" })}</span>}
                  </div>
                  <p className="truncate text-[16px] font-semibold">{item.title}</p>
                  <p className="truncate text-[13px] text-label-2">
                    {c && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    )}
                    {c && item.tags.length > 0 && " · "}
                    {item.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                </div>
              </Link>
            );
          })}
        </Bento>
      )}
    </>
  );
}
