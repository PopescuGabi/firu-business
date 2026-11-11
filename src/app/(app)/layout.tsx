import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Sidebar, TabBar } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { getBackground } from "@/lib/background";
import { getSettings } from "@/lib/settings";
import { ThemeSync } from "@/components/theme-sync";
import { SoundEffects } from "@/components/sound-effects";
import { getDb, schema } from "@/lib/db";
import { listPages } from "@/lib/custom-pages-db";
import { linksForViewer } from "@/lib/client-links";
import { GlassProvider, GlassDebug } from "@/components/glass";
import { Jarvis } from "@/components/jarvis";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // First sign-in: choose sections before anything else.
  if (!user.onboarded) redirect("/onboarding");
  const db = await getDb();
  const [clients, background, settings, pages, links] = await Promise.all([
    db
      .select({ id: schema.clients.id, name: schema.clients.name, color: schema.clients.color })
      .from(schema.clients)
      .where(and(eq(schema.clients.userId, user.id), eq(schema.clients.archived, false)))
      .orderBy(asc(schema.clients.name)),
    getBackground(user.id),
    getSettings(user.id),
    listPages(user.id),
    linksForViewer(user.id),
  ]);
  // "From Gabi" for each business that shares a dashboard with this person (client name added when one agency shares several).
  const navShared = links.map((l) => ({
    href: `/shared/${l.id}`,
    label: links.filter((x) => x.agencyId === l.agencyId).length > 1 ? `${l.clientName} · ${l.agencyName}` : `From ${l.agencyName}`,
  }));
  const navPages = pages.map(({ slug, title, icon }) => ({ slug, title, icon }));
  return (
    <GlassProvider>
    <div className="flex min-h-dvh" data-bg={background.kind}>
      {background.css && <style>{background.css}</style>}
      <ThemeSync theme={settings.theme} />
      <SoundEffects on={settings.sounds} />
      <Sidebar clients={clients} modules={user.modules} pages={navPages} shared={navShared} me={{ name: user.name?.trim() || user.email.split("@")[0], picture: user.picture }} />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-48 sm:px-6 md:pr-7 md:pb-28 md:pl-5">
        <div className="mx-auto max-w-[1680px]">{children}</div>
      </main>
      <TabBar modules={user.modules} clients={clients} pages={navPages} shared={navShared} />
      <Jarvis />
      <GlassDebug />
    </div>
    </GlassProvider>
  );
}
