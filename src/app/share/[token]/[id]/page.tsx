import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Card, Pill } from "@/components/ui";
import { publicPreviewUrl, publicThumbUrl } from "@/lib/google/drive";
import { publicItem, typeLabel } from "@/lib/portfolio";
import { shortUrl } from "@/lib/portfolio-types";
import { recordShareView } from "@/lib/share-views";
import { fmtDate } from "@/lib/time";

export default async function ShareItemPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const data = Number.isInteger(Number(id)) ? await publicItem(token, Number(id)) : null;
  if (!data) notFound();
  await recordShareView(data.owner.id, data.item.id);
  const { item, clients } = data;
  const client = clients.find((c) => c.id === item.clientId);
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8">
      <Link href={`/share/${token}`} className="mb-6 inline-flex items-center gap-1 text-[14px] font-semibold text-accent">
        <ChevronLeft size={16} /> All work
      </Link>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pill color="var(--accent)">{typeLabel(item.type)}</Pill>
        {item.date && <span className="text-[13px] text-label-2">{fmtDate(item.date, { day: "numeric", month: "long", year: "numeric" })}</span>}
        {client && <span className="text-[13px] text-label-2">· {client.name}</span>}
      </div>
      <h1 className="text-[36px] leading-tight font-bold tracking-tight sm:text-[46px]">{item.title}</h1>
      {item.tags.length > 0 && <p className="mt-2 text-[14px] text-label-2">{item.tags.map((t) => `#${t}`).join("  ")}</p>}
      {item.description && <p className="mt-5 max-w-3xl text-[17px] leading-relaxed whitespace-pre-line">{item.description}</p>}
      {item.link && (
        <a href={item.link} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-on-ink">
          <ExternalLink size={16} /> Open {shortUrl(item.link)}
        </a>
      )}
      <div className="mt-8 flex flex-col gap-6">
        {item.files.map((f) =>
          f.mimeType.startsWith("image/") ? (
            <Card key={f.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicThumbUrl(f.id, 2000)} alt={f.name} referrerPolicy="no-referrer" className="block w-full" />
            </Card>
          ) : (
            <Card key={f.id} className={f.mimeType.startsWith("video/") ? "aspect-video" : "aspect-[4/3]"}>
              <iframe src={publicPreviewUrl(f.id)} title={f.name} allow="autoplay; fullscreen" allowFullScreen className="size-full border-0" />
            </Card>
          ),
        )}
      </div>
    </main>
  );
}
