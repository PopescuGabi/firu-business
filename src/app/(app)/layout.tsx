import { asc, eq } from "drizzle-orm";
import { Sidebar, TabBar } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const db = await getDb();
  const clients = await db
    .select({ id: schema.clients.id, name: schema.clients.name, color: schema.clients.color })
    .from(schema.clients)
    .where(eq(schema.clients.archived, false))
    .orderBy(asc(schema.clients.name));
  return (
    <div className="flex min-h-dvh">
      <Sidebar clients={clients} />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-32 sm:px-6 md:pr-8 md:pb-12 md:pl-6">
        <div className="mx-auto max-w-[1680px]">{children}</div>
      </main>
      <TabBar />
    </div>
  );
}
