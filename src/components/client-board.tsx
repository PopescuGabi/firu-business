import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { BarChart3, CalendarDays, Clapperboard, Flame, Grid2x2, Images, LineChart, ListOrdered, Smartphone, Sparkles, Table2, TrendingUp, Users } from "lucide-react";
import type { BoardWidget } from "@/components/board/board";
import { IG_WIDGETS, instagramWidgets, type DashQuery } from "@/components/instagram/dashboard";
import { Card, Pill, STATUS_COLORS, statusLabel } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import type { Dashboard } from "@/lib/instagram/stats";

const IG_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  "ig-summary": Sparkles,
  "ig-kpis": Users,
  "ig-kpis-more": BarChart3,
  "ig-reach": LineChart,
  "ig-followers": TrendingUp,
  "ig-weekly": BarChart3,
  "ig-calendar": CalendarDays,
  "ig-heatmap": Flame,
  "ig-formats": Grid2x2,
  "ig-top": Images,
  "ig-posts": Table2,
};

/** What can go on a client's dashboard: only the parts the business shares (Instagram, content, app updates). */
export function clientCatalogue(shared: readonly string[]): BoardWidget[] {
  const out: BoardWidget[] = [];
  if (shared.includes("instagram"))
    for (const { title, hint, ...def } of IG_WIDGETS) {
      const Icon = IG_ICONS[def.id] ?? BarChart3;
      out.push({ def, title, hint, group: "Instagram", icon: <Icon size={17} /> });
    }
  if (shared.includes("content"))
    out.push({ def: { id: "content", size: { w: 6, h: 5 }, min: { w: 3, h: 3 }, max: { w: 12, h: 10 } }, title: "Content", hint: "Reels and carousels for review or posted", group: "Work", icon: <Clapperboard size={17} /> });
  if (shared.includes("app"))
    out.push({ def: { id: "app-updates", size: { w: 6, h: 5 }, min: { w: 3, h: 3 }, max: { w: 12, h: 10 } }, title: "App updates", hint: "Versions and what changed", group: "Work", icon: <Smartphone size={17} /> });
  return out;
}

/** A client's dashboard before anyone arranged it. */
export const CLIENT_DEFAULT = ["ig-summary", "ig-kpis", "ig-reach", "ig-followers", "ig-top", "content", "app-updates", "ig-posts"];

export const isInstagramWidget = (id: string) => id.startsWith("ig-");

const shortDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The widgets on a client's board, rendered. Content and app updates are the agency's rows for this client only;
 * Instagram comes from the dashboard data the page loaded (or is left out when not on the board).
 */
export async function clientWidgets({
  ids,
  agencyId,
  clientId,
  instagram,
}: {
  ids: Set<string>;
  agencyId: number;
  clientId: number;
  instagram: { data: Dashboard; query: DashQuery; href: (q: Partial<DashQuery>) => string } | null;
}): Promise<Record<string, React.ReactNode>> {
  const db = await getDb();
  const out: Record<string, React.ReactNode> = instagram ? instagramWidgets(instagram) : {};

  if (ids.has("content")) {
    const [reels, carousels] = await Promise.all([
      db
        .select({ id: schema.reels.id, title: schema.reels.title, status: schema.reels.status, date: schema.reels.postDate, updatedAt: schema.reels.updatedAt })
        .from(schema.reels)
        .where(and(eq(schema.reels.userId, agencyId), eq(schema.reels.clientId, clientId), inArray(schema.reels.status, ["review", "posted"])))
        .orderBy(desc(schema.reels.updatedAt)),
      db
        .select({ id: schema.carousels.id, title: schema.carousels.title, status: schema.carousels.status, updatedAt: schema.carousels.updatedAt })
        .from(schema.carousels)
        .where(and(eq(schema.carousels.userId, agencyId), eq(schema.carousels.clientId, clientId), inArray(schema.carousels.status, ["review", "approved", "posted"])))
        .orderBy(desc(schema.carousels.updatedAt)),
    ]);
    const items = [...reels.map((r) => ({ ...r, kind: "Reel" })), ...carousels.map((c) => ({ ...c, date: null as string | null, kind: "Carousel" }))].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
    out.content = (
      <Card className="flex h-full flex-col p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Clapperboard size={16} className="text-label-2" /> Content
        </h3>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length ? (
            <ul className="divide-y divide-separator">
              {items.map((i) => (
                <li key={`${i.kind}-${i.id}`} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="text-[11px] font-semibold text-label-2 uppercase">{i.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{i.title}</span>
                  <Pill color={STATUS_COLORS[i.status]}>{i.status === "review" ? "Ready for your review" : statusLabel(i.status)}</Pill>
                  <span className="text-[12px] text-label-3">{i.date ? shortDate(i.date) : shortDate(i.updatedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-label-2">Reels and carousels appear here when they&apos;re ready for review or posted.</p>
          )}
        </div>
      </Card>
    );
  }

  if (ids.has("app-updates")) {
    const updates = await db
      .select()
      .from(schema.appUpdates)
      .where(and(eq(schema.appUpdates.userId, agencyId), eq(schema.appUpdates.clientId, clientId)))
      .orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id));
    out["app-updates"] = (
      <Card className="flex h-full flex-col p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <ListOrdered size={16} className="text-label-2" /> App updates
        </h3>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {updates.length ? (
            <ul className="flex flex-col gap-3">
              {updates.map((u) => (
                <li key={u.id} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold">
                      {u.version && `${u.version} · `}
                      {u.title}
                    </p>
                    <Pill color={STATUS_COLORS[u.status]}>{statusLabel(u.status)}</Pill>
                    {u.date && <span className="text-[12px] text-label-3">{shortDate(u.date)}</span>}
                  </div>
                  {u.notes && <p className="text-[13px] whitespace-pre-wrap text-label-2">{u.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-label-2">No updates yet.</p>
          )}
        </div>
      </Card>
    );
  }
  return out;
}
