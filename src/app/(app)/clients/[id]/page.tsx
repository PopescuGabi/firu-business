import Link from "next/link";
import { SegmentedLinks, Slide } from "@/components/motion";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Archive, Clapperboard, GalleryHorizontalEnd, Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { ClientForm } from "@/components/client-form";
import { DriveFiles } from "@/components/drive-files";
import { DriveFolderButton } from "@/components/drive-folder-button";
import { Sheet } from "@/components/sheet";
import { SlidePreview } from "@/components/slide-preview";
import { ConfirmButton, Submit } from "@/components/submit";
import { buttonClass, Card, Empty, Field, PageHeader, Pill, STATUS_COLORS, statusLabel } from "@/components/ui";
import {
  createAppUpdate,
  createCarousel,
  createReel,
  deleteAppUpdate,
  editAppUpdate,
  setClientArchived,
  updateClient,
} from "@/app/actions/clients";
import { getDb, schema } from "@/lib/db";
import { folderUrl } from "@/lib/google/drive";
import { getGoogleAccount } from "@/lib/google/oauth";

const TABS = [
  { key: "app", label: "App", icon: Smartphone },
  { key: "reels", label: "Reels", icon: Clapperboard },
  { key: "carousels", label: "Carousels", icon: GalleryHorizontalEnd },
] as const;

const REEL_STATUSES = ["idea", "scripting", "filming", "editing", "review", "posted"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const db = await getDb();
  const [c] = await db.select({ name: schema.clients.name }).from(schema.clients).where(eq(schema.clients.id, Number((await params).id) || 0));
  return { title: c?.name ?? "Client" };
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id));
  if (!client) notFound();
  const { tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : client.appName ? "app" : "reels";
  const googleConnected = Boolean((await getGoogleAccount())?.accessToken);

  return (
    <>
      <PageHeader
        subtitle={client.archived ? "Archived client" : "Client"}
        title={client.name}
        actions={
          <>
            {googleConnected && <DriveFolderButton clientId={id} url={client.driveFolderId ? folderUrl(client.driveFolderId) : null} />}
            <Sheet title="Edit client" trigger={<Pencil size={16} />} triggerLabel="Edit client" triggerClassName={buttonClass("gray") + " !px-3"}>
              <ClientForm action={updateClient.bind(null, id)} client={client} submitLabel="Save" />
              {!client.archived && (
                <form action={setClientArchived.bind(null, id, true)} className="mt-3 border-t border-separator pt-3">
                  <ConfirmButton message={`Archive ${client.name}? You can restore it from the Clients page.`}>
                    <Archive size={15} /> Archive client
                  </ConfirmButton>
                </form>
              )}
            </Sheet>
          </>
        }
      />
      {client.description && <p className="-mt-3 mb-5 text-[15px] text-label-2">{client.description}</p>}

      <SegmentedLinks
        label="Sections"
        className="mb-6"
        active={tab}
        items={TABS.map(({ key, label, icon: Icon }) => ({ key, label, href: `/clients/${id}?tab=${key}`, icon: <Icon size={15} /> }))}
      />

      <Slide group={`client-tab-${id}`} index={TABS.findIndex((t) => t.key === tab)}>
        {tab === "app" && <AppTab clientId={id} appName={client.appName} googleConnected={googleConnected} />}
        {tab === "reels" && <ReelsTab clientId={id} />}
        {tab === "carousels" && <CarouselsTab clientId={id} />}
      </Slide>
    </>
  );
}

function UpdateForm({
  action,
  update,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  update?: { version: string; title: string; notes: string; status: string; date: string | null };
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <Field label="Version">
          <input name="version" maxLength={50} defaultValue={update?.version} className="field" placeholder="1.4.0" />
        </Field>
        <Field label="Title">
          <input name="title" required maxLength={200} defaultValue={update?.title} className="field" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select name="status" defaultValue={update?.status ?? "planned"} className="field">
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="shipped">Shipped</option>
          </select>
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={update?.date ?? ""} className="field" />
        </Field>
      </div>
      <Field label="What changed">
        <textarea name="notes" rows={7} defaultValue={update?.notes} className="field" placeholder="- New booking flow&#10;- Fixed gallery upload" />
      </Field>
      <Submit className="self-end">{submitLabel}</Submit>
    </form>
  );
}

async function AppTab({ clientId, appName, googleConnected }: { clientId: number; appName: string; googleConnected: boolean }) {
  const db = await getDb();
  const updates = await db
    .select()
    .from(schema.appUpdates)
    .where(eq(schema.appUpdates.clientId, clientId))
    .orderBy(desc(schema.appUpdates.date), desc(schema.appUpdates.id));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">{appName || "App"} updates</h2>
        <Sheet title="New app update" trigger={<><Plus size={16} /> New update</>} triggerClassName={buttonClass("filled")}>
          <UpdateForm action={createAppUpdate.bind(null, clientId)} submitLabel="Add update" />
        </Sheet>
      </div>
      {updates.length === 0 ? (
        <Empty icon={<Smartphone size={36} />} title="No updates yet">Log each version: what changed, its status and screenshots in Drive.</Empty>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-separator pl-5">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span className="absolute top-5 -left-[27px] size-3 rounded-full border-2 border-bg" style={{ background: STATUS_COLORS[u.status] }} />
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {u.version && <span className="rounded-md bg-fill px-1.5 py-0.5 font-mono text-[12px] font-semibold">v{u.version.replace(/^v/i, "")}</span>}
                  <h3 className="flex-1 text-[17px] font-semibold">{u.title}</h3>
                  <Pill color={STATUS_COLORS[u.status]}>{statusLabel(u.status)}</Pill>
                  {u.date && <span className="text-[13px] text-label-2">{u.date}</span>}
                  <Sheet title="Edit update" trigger={<Pencil size={15} />} triggerLabel={`Edit ${u.title}`} triggerClassName="cursor-pointer rounded-full p-1.5 text-label-2 hover:bg-fill">
                    <UpdateForm action={editAppUpdate.bind(null, u.id)} update={u} submitLabel="Save" />
                    <form action={deleteAppUpdate.bind(null, u.id)} className="mt-3 border-t border-separator pt-3">
                      <ConfirmButton message="Delete this update? Its Drive files stay in Drive.">
                        <Trash2 size={15} /> Delete update
                      </ConfirmButton>
                    </form>
                  </Sheet>
                </div>
                {u.notes && <p className="mt-2 text-[14px] whitespace-pre-line text-label-2">{u.notes}</p>}
                <div className="mt-3">
                  <DriveFiles clientId={clientId} section="App" target="appUpdate" targetId={u.id} files={u.files} googleConnected={googleConnected} />
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

async function ReelsTab({ clientId }: { clientId: number }) {
  const db = await getDb();
  const reels = await db.select().from(schema.reels).where(eq(schema.reels.clientId, clientId)).orderBy(desc(schema.reels.updatedAt));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">Reels</h2>
        <Sheet title="New reel" trigger={<><Plus size={16} /> New reel</>} triggerClassName={buttonClass("filled")}>
          <form action={createReel.bind(null, clientId)} className="flex flex-col gap-4">
            <Field label="Working title">
              <input name="title" required maxLength={200} className="field" autoFocus />
            </Field>
            <Field label="Planned post date">
              <input name="postDate" type="date" className="field" />
            </Field>
            <Submit className="self-end">Create and open editor</Submit>
          </form>
        </Sheet>
      </div>
      {reels.length === 0 ? (
        <Empty icon={<Clapperboard size={36} />} title="No reels yet">Each reel gets a script, caption, notes, Drive files and Opus 5.5 as editor.</Empty>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
          {REEL_STATUSES.map((s) => {
            const list = reels.filter((r) => r.status === s);
            return (
              <div key={s} className="w-[220px] shrink-0 snap-start lg:w-auto">
                <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold">
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                  {statusLabel(s)} <span className="font-normal text-label-2">{list.length}</span>
                </p>
                <div className="flex flex-col gap-2">
                  {list.map((r) => (
                    <Link key={r.id} href={`/clients/${clientId}/reels/${r.id}`}>
                      <Card className="p-3 transition hover:shadow-lg">
                        <p className="line-clamp-2 text-[14px] font-semibold">{r.title}</p>
                        {r.hook && <p className="mt-1 line-clamp-2 text-[12px] text-label-2">{r.hook}</p>}
                        <p className="mt-2 flex gap-2 text-[11px] text-label-2">
                          {r.postDate && <span>📅 {r.postDate}</span>}
                          {r.files.length > 0 && <span>📎 {r.files.length}</span>}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

async function CarouselsTab({ clientId }: { clientId: number }) {
  const db = await getDb();
  const carousels = await db
    .select()
    .from(schema.carousels)
    .where(eq(schema.carousels.clientId, clientId))
    .orderBy(desc(schema.carousels.updatedAt));
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold">Carousels</h2>
        <Sheet title="New carousel" trigger={<><Plus size={16} /> New carousel</>} triggerClassName={buttonClass("filled")}>
          <form action={createCarousel.bind(null, clientId)} className="flex flex-col gap-4">
            <Field label="Title">
              <input name="title" required maxLength={200} className="field" autoFocus />
            </Field>
            <Submit className="self-end">Create and open editor</Submit>
          </form>
        </Sheet>
      </div>
      {carousels.length === 0 ? (
        <Empty icon={<GalleryHorizontalEnd size={36} />} title="No carousels yet">Write and design slides here, and edit them with Claude without switching apps.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {carousels.map((c) => (
            <Link key={c.id} href={`/clients/${clientId}/carousels/${c.id}`} className="group">
              <Card className="transition group-hover:shadow-lg">
                <SlidePreview slide={c.slides[0] ?? { heading: "", body: "" }} theme={c.theme} index={0} total={Math.max(1, c.slides.length)} />
                <div className="p-3">
                  <p className="truncate text-[14px] font-semibold">{c.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] text-label-2">
                    <Pill color={STATUS_COLORS[c.status]}>{statusLabel(c.status)}</Pill>
                    {c.slides.length} slides
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
