import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ExternalLink, Mail } from "lucide-react";
import { MailToTask, ReplyForm } from "@/components/mail-actions";
import { SegmentedLinks } from "@/components/motion";
import { buttonClass, Card, Empty, PageHeader } from "@/components/ui";
import { claudeAvailable } from "@/lib/ai/claude";
import { requireModule } from "@/lib/sections";
import { getMail, gmailConnected, gmailLink, listInbox } from "@/lib/google/gmail";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Email" };

const FILTERS = [
  { key: "inbox", label: "Inbox", q: "in:inbox" },
  { key: "unread", label: "Unread", q: "in:inbox is:unread" },
  { key: "important", label: "Important", q: "in:inbox is:important" },
] as const;

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ m?: string; f?: string }> }) {
  const user = await requireModule("email");
  const { m, f } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  if (!(await gmailConnected(user.id))) {
    return (
      <>
        <PageHeader title="Email" />
        <Empty icon={<Mail size={36} />} title="Connect your Gmail">
          <p>See important mail at a glance, reply, and turn emails into tasks. Google will ask you to allow reading and sending email for FIRU Business.</p>
          <a href="/api/auth/google?gmail=1" className={clsx(buttonClass("filled"), "mt-4")}>
            Connect Gmail
          </a>
        </Empty>
      </>
    );
  }

  const settings = await getSettings(user.id);
  let error: string | null = null;
  const [inbox, open] = await Promise.all([
    listInbox(user.id, { q: filter.q }).catch((e) => {
      error = e instanceof Error ? e.message : "Couldn't load your inbox";
      return [];
    }),
    m ? getMail(user.id, m).catch(() => null) : null,
  ]);
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: settings.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const href = (p: { m?: string; f?: string }) => `/email?${new URLSearchParams(Object.entries({ f: filter.key, ...p }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader title="Email" subtitle={user.email} />
      <SegmentedLinks label="Mail filters" className="mb-4" active={filter.key} items={FILTERS.map((x) => ({ key: x.key, label: x.label, href: href({ f: x.key, m: undefined }) }))} />
      {error && <p className="mb-4 text-[14px] text-red">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        {/* On phones an open email takes the whole width; the list comes back with "Inbox". */}
        <Card className={clsx("flex flex-col gap-0.5 self-start rounded-[22px] p-1.5", open && "hidden lg:flex")}>
          {inbox.length === 0 && <p className="p-4 text-[14px] text-label-2">Nothing here.</p>}
          {inbox.map((mail) => (
            <Link
              key={mail.id}
              href={href({ m: mail.id })}
              className={clsx("flex gap-2.5 rounded-[14px] px-3 py-2.5 transition", m === mail.id ? "sel-pane" : "hover:bg-fill")}
            >
              <span className={clsx("mt-[7px] size-2 shrink-0 rounded-full", mail.unread ? "bg-accent" : "bg-transparent")} aria-label={mail.unread ? "Unread" : undefined} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={clsx("min-w-0 flex-1 truncate text-[14px]", mail.unread ? "font-semibold" : "font-medium")}>{mail.from}</span>
                  <span className="shrink-0 text-[12px] text-label-3">{when(mail.date)}</span>
                </span>
                <span className={clsx("block truncate text-[14px]", mail.unread ? "font-semibold" : "text-label")}>{mail.subject}</span>
                <span className="block truncate text-[13px] text-label-2">{mail.snippet}</span>
              </span>
            </Link>
          ))}
        </Card>
        {open ? (
          <Card className="flex flex-col gap-4 rounded-[22px] p-6">
            <Link href={href({ m: undefined })} className="-mb-1 inline-flex items-center gap-1 text-[14px] font-semibold text-accent lg:hidden">
              <ChevronLeft size={16} /> {filter.label}
            </Link>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-[15px] font-semibold text-accent">{(open.from.trim()[0] ?? "?").toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{open.from}</p>
                <p className="truncate text-[12px] text-label-2">
                  {open.fromEmail} · {when(open.date)}
                </p>
              </div>
              <a href={gmailLink(open)} target="_blank" rel="noreferrer" aria-label="Open in Gmail" className={clsx(buttonClass("gray"), "!size-9 !px-0")}>
                <ExternalLink size={15} />
              </a>
            </div>
            <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{open.subject}</h2>
            {/* Shown as plain text only: an email's content is never rendered as HTML. */}
            <div className="max-h-[50vh] overflow-y-auto text-[14px] leading-relaxed whitespace-pre-wrap">{open.body || open.snippet}</div>
            <div className="border-t border-separator" />
            <MailToTask id={open.id} subject={open.subject} />
            <ReplyForm key={open.id} id={open.id} to={open.fromEmail} ai={await claudeAvailable(user.id)} />
          </Card>
        ) : (
          <Card className="hidden min-h-[60vh] place-items-center self-start rounded-[22px] p-10 text-center lg:sticky lg:top-6 lg:grid">
            <div>
              <span className="glass mx-auto mb-3 grid size-12 place-items-center rounded-[14px] text-label-2">
                <Mail size={20} />
              </span>
              <p className="text-[15px] font-semibold">Pick an email to read it</p>
              <p className="mt-1 text-[13px] text-label-2">Then reply with Claude&apos;s help, or turn it into a task.</p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
