import Link from "next/link";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Bento, Pill, spanStyle } from "@/components/ui";
import { publicThumbUrl } from "@/lib/google/drive";
import { coverOf, publicPortfolio, typeLabel } from "@/lib/portfolio";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/time";

// Public: the items you marked public, at an address only you hand out (see Portfolio → Share).
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const data = await publicPortfolio((await params).token);
  if (!data) return { title: "Portfolio" };
  const { displayName } = await getSettings(data.owner.id);
  return { title: displayName ? `${displayName} · Portfolio` : "Portfolio" };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await publicPortfolio(token);
  if (!data) notFound();
  const { displayName } = await getSettings(data.owner.id);
  const client = (id: number | null) => data.clients.find((c) => c.id === id);
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
      <header className="mb-8">
        <div className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-label-2">
          <LogoMark size={20} /> Portfolio
        </div>
        <h1 className="text-[40px] leading-tight font-bold tracking-tight sm:text-[52px]">{displayName ? `${displayName}'s work` : "Selected work"}</h1>
        <p className="mt-2 text-[16px] text-label-2">
          {data.items.length} piece{data.items.length === 1 ? "" : "s"}
        </p>
      </header>
      {data.items.length === 0 ? (
        <p className="text-label-2">Nothing here yet.</p>
      ) : (
        <Bento>
          {data.items.map((item, i) => {
            const cover = coverOf(item);
            const c = client(item.clientId);
            const span = i === 0 ? { p: 2, t: 6, l: 8, d: 6, rl: 2, rd: 2 } : { p: 2, t: 3, l: 4, d: 3 };
            return (
              <Link key={item.id} href={`/share/${token}/${item.id}`} className="tile glass group flex flex-col overflow-hidden rounded-[24px]" style={spanStyle(span, i)}>
                <div className="relative min-h-48 flex-1 overflow-hidden bg-fill">
                  {cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicThumbUrl(cover.id, i === 0 ? 1600 : 900)} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Pill color="var(--accent)">{typeLabel(item.type)}</Pill>
                    {item.date && <span className="text-[12px] text-label-2">{fmtDate(item.date, { month: "short", year: "numeric" })}</span>}
                  </div>
                  <p className="truncate text-[16px] font-semibold">{item.title}</p>
                  {(c || item.tags.length > 0) && (
                    <p className="truncate text-[13px] text-label-2">
                      {c?.name}
                      {c && item.tags.length > 0 && " · "}
                      {item.tags.map((t) => `#${t}`).join(" ")}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </Bento>
      )}
    </main>
  );
}
