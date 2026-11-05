import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ExternalLink, Mail } from "lucide-react";
import { MailToTask, ReplyForm } from "@/components/mail-actions";
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
          <p>See important mail at a glance, reply, and turn emails into tasks. Google will ask you to allow reading and sending email for Personal Hub.</p>
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
      <div className="mb-4 flex gap-2">
        {FILTERS.map((x) => (
          <Link key={x.key} href={href({ f: x.key, m: undefined })} className={clsx("rounded-full px-3 py-1.5 text-[13px] font-medium", x.key === filter.key ? "bg-ink text-on-ink" : "glass text-label-2")}>
            {x.label}
          </Link>
        ))}
      </div>
      {error && <p className="mb-4 text-[14px] text-red">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        {/* On phones an open email takes the whole width; the list comes back with "Inbox". */}
        <Card className={clsx("divide-y divide-separator self-start", open && "hidden lg:block")}>
          {inbox.length === 0 && <p className="p-4 text-[14px] text-label-2">Nothing here.</p>}
          {inbox.map((mail) => (
            <Link key={mail.id} href={href({ m: mail.id })} className={clsx("block px-4 py-3 transition hover:bg-fill", m === mail.id && "bg-fill")}>
              <div className="flex items-center gap-2">
                {mail.unread && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                <p className={clsx("min-w-0 flex-1 truncate text-[14px]", mail.unread && "font-semibold")}>{mail.from}</p>
                <span className="shrink-0 text-[12px] text-label-2">{when(mail.date)}</span>
              </div>
              <p className={clsx("truncate text-[14px]", mail.unread ? "font-medium" : "text-label-2")}>{mail.subject}</p>
              <p className="truncate text-[13px] text-label-2">{mail.snippet}</p>
            </Link>
          ))}
        </Card>
        {open ? (
          <Card className="flex flex-col gap-4 p-5">
            <Link href={href({ m: undefined })} className="-mb-1 inline-flex items-center gap-1 text-[14px] font-semibold text-accent lg:hidden">
              <ChevronLeft size={16} /> {filter.label}
            </Link>
            <div>
              <h2 className="text-[20px] leading-tight font-semibold">{open.subject}</h2>
              <p className="mt-1 text-[13px] text-label-2">
                {open.from} &lt;{open.fromEmail}&gt; · {when(open.date)}
              </p>
            </div>
            {/* Shown as plain text only: an email's content is never rendered as HTML. */}
            <div className="max-h-[50vh] overflow-y-auto text-[14px] leading-relaxed whitespace-pre-wrap">{open.body || open.snippet}</div>
            <div className="flex flex-wrap items-center gap-2 border-t border-separator pt-4">
              <a href={gmailLink(open)} target="_blank" rel="noreferrer" className={buttonClass("gray", "sm")}>
                <ExternalLink size={13} /> Open in Gmail
              </a>
            </div>
            <MailToTask id={open.id} subject={open.subject} />
            <ReplyForm key={open.id} id={open.id} to={open.fromEmail} ai={await claudeAvailable(user.id)} />
          </Card>
        ) : (
          <Card className="hidden place-items-center p-10 text-[14px] text-label-2 lg:grid">Pick an email to read it.</Card>
        )}
      </div>
    </>
  );
}
