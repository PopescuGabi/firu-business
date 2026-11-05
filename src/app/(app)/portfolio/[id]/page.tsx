import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ChevronLeft, ExternalLink, FileText, Film, Image as ImageIcon, Star, X } from "lucide-react";
import { detachPortfolioFile, setPortfolioCover, updatePortfolioItem } from "@/app/actions/portfolio";
import { DeleteItemButton, PortfolioFields, PortfolioUploader, PublicToggle } from "@/components/portfolio";
import { Submit } from "@/components/submit";
import { buttonClass, Card, PageHeader, Pill, Section } from "@/components/ui";
import { requireModule } from "@/lib/sections";
import { getDb, schema } from "@/lib/db";
import { coverOf, typeLabel } from "@/lib/portfolio";
import { shortUrl } from "@/lib/portfolio-types";

export const metadata = { title: "Portfolio item" };

const iconFor = (mime: string) => (mime.startsWith("video/") ? Film : mime.startsWith("image/") ? ImageIcon : FileText);

export default async function PortfolioItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const user = await requireModule("portfolio");
  const db = await getDb();
  const [[item], clients] = await Promise.all([
    db.select().from(schema.portfolioItems).where(and(eq(schema.portfolioItems.id, id), eq(schema.portfolioItems.userId, user.id))),
    db.select({ id: schema.clients.id, name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.userId, user.id)).orderBy(asc(schema.clients.name)),
  ]);
  if (!item) notFound();
  const cover = coverOf(item);

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link href="/portfolio" className="mb-2 inline-flex items-center gap-1 text-[14px] font-semibold text-accent">
        <ChevronLeft size={16} /> Portfolio
      </Link>
      <PageHeader
        title={item.title}
        subtitle={<Pill color="var(--accent)">{typeLabel(item.type)}</Pill>}
        actions={
          <>
            {item.link && (
              <a href={item.link} target="_blank" rel="noreferrer" className={buttonClass("gray")} title={item.link}>
                <ExternalLink size={16} /> Open {shortUrl(item.link)}
              </a>
            )}
            <PublicToggle id={item.id} isPublic={item.public} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Card className="relative aspect-video">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/drive/thumb/${cover.id}?s=1600`} alt="" className="absolute inset-0 size-full object-contain" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-[14px] text-label-2">No cover yet: upload an image or video below.</div>
            )}
          </Card>

          <Section title={`Files (${item.files.length})`} footer="Files go to Personal Hub/Portfolio in your Drive. Removing one here keeps it in Drive.">
            <div className="flex flex-col gap-3">
              {item.files.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {item.files.map((f) => {
                    const Icon = iconFor(f.mimeType);
                    const isCover = cover?.id === f.id;
                    return (
                      <Card key={f.id} className="group relative">
                        <div className="relative aspect-[4/3] bg-fill">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/drive/thumb/${f.id}?s=500`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                          <Icon size={16} className="absolute bottom-2 left-2 text-white drop-shadow" />
                          {isCover && (
                            <span className="chrome absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">Cover</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 p-2">
                          <p className="min-w-0 flex-1 truncate text-[12px]" title={f.name}>{f.name}</p>
                          {!isCover && (
                            <form action={setPortfolioCover.bind(null, item.id, f.id)}>
                              <button aria-label="Use as cover" title="Use as cover" className="grid size-7 cursor-pointer place-items-center rounded-full text-label-2 hover:bg-fill hover:text-label">
                                <Star size={14} />
                              </button>
                            </form>
                          )}
                          {f.webViewLink && (
                            <a href={f.webViewLink} target="_blank" rel="noreferrer" aria-label="Open in Drive" className="grid size-7 place-items-center rounded-full text-label-2 hover:bg-fill hover:text-label">
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <form action={detachPortfolioFile.bind(null, item.id, f.id)}>
                            <button aria-label="Remove from portfolio" title="Remove from portfolio" className="grid size-7 cursor-pointer place-items-center rounded-full text-label-2 hover:bg-fill hover:text-red">
                              <X size={14} />
                            </button>
                          </form>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              <PortfolioUploader id={item.id} />
            </div>
          </Section>
        </div>

        <div>
          <Section title="Details">
            <Card className="p-4">
              <form action={updatePortfolioItem.bind(null, item.id)} className="flex flex-col gap-4">
                <PortfolioFields clients={clients} item={item} />
                <Submit className="self-end">Save</Submit>
              </form>
            </Card>
          </Section>
          <p className="mb-6 px-1 text-[13px] text-label-2">
            {item.public
              ? "Public: shown on your share page, and its files can be viewed by anyone with the link."
              : "Private: only you can see it. Make it public to show it on your share page."}
          </p>
          <DeleteItemButton id={item.id} />
        </div>
      </div>
    </div>
  );
}
