import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Sidebar, TabBar } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { getBackground } from "@/lib/background";
import { getSettings } from "@/lib/settings";
import { ThemeSync } from "@/components/theme-sync";
import { SoundEffects } from "@/components/sound-effects";
import { getDb, schema } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // First sign-in: choose sections before anything else.
  if (!user.onboarded) redirect("/onboarding");
  const db = await getDb();
  const [clients, background, settings] = await Promise.all([
    db
      .select({ id: schema.clients.id, name: schema.clients.name, color: schema.clients.color })
      .from(schema.clients)
      .where(and(eq(schema.clients.userId, user.id), eq(schema.clients.archived, false)))
      .orderBy(asc(schema.clients.name)),
    getBackground(user.id),
    getSettings(user.id),
  ]);
  return (
    <div className="flex min-h-dvh" data-bg={background.kind}>
      {background.css && <style>{background.css}</style>}
      <ThemeSync theme={settings.theme} />
      <SoundEffects on={settings.sounds} />
      <Sidebar clients={clients} modules={user.modules} />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-32 sm:px-6 md:pr-8 md:pb-12 md:pl-6">
        <div className="mx-auto max-w-[1680px]">{children}</div>
      </main>
      <TabBar modules={user.modules} />
    </div>
  );
}
