import Link from "next/link";
import { Plus } from "lucide-react";
import { IgAccountActions } from "@/components/instagram/actions";
import { InstagramDashboard } from "@/components/instagram/dashboard";
import { IgNotice } from "@/components/instagram/notice";
import { buttonClass, PageHeader } from "@/components/ui";
import { instagramConfigured } from "@/lib/instagram/api";
import { accountData, ownAccounts } from "@/lib/instagram/data";
import { DEMO_ACCOUNT, demoData } from "@/lib/instagram/demo";
import { dashHref, dashQuery } from "@/lib/instagram/query";
import { buildDashboard } from "@/lib/instagram/stats";
import { requireModule } from "@/lib/sections";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Instagram" };

type SP = Record<string, string | string[] | undefined>;

/** Your own Instagram analytics (a connected professional account), or a clearly marked demo until one is connected. */
export default async function InstagramPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireModule("instagram");
  const sp = await searchParams;
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const q = dashQuery(sp, today);
  const accounts = await ownAccounts(user.id);
  const picked = accounts.find((a) => String(a.id) === sp.account) ?? accounts[0];
  const configured = instagramConfigured();
  const connect = (
    <a href="/api/instagram/connect?for=own&back=/instagram" className={buttonClass(accounts.length ? "gray" : "filled", "sm")}>
      <Plus size={14} /> {accounts.length ? "Add account" : "Connect Instagram"}
    </a>
  );

  const source = picked ? await accountData(user.id, picked.id) : demoData(today);
  const data = buildDashboard({ ...source, from: q.from, to: q.to, kind: q.kind, tz: settings.timezone });
  const href = dashHref("/instagram", { account: picked && accounts.length > 1 ? String(picked.id) : undefined }, q);

  return (
    <>
      <PageHeader title="Instagram" subtitle="Analytics" />
      <IgNotice flag={typeof sp.ig === "string" ? sp.ig : undefined} />
      {!configured && (
        <p className="mb-4 rounded-[14px] bg-well px-3 py-2 text-[13px] text-label-2">
          Instagram isn&apos;t connected to FIRU Business yet: the Meta app keys are missing.{" "}
          {user.role === "owner" ? (
            <Link href="/settings#instagram" className="font-semibold text-accent">
              How to set it up
            </Link>
          ) : (
            "The hub's owner sets this up once."
          )}
        </p>
      )}
      {accounts.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {accounts.map((a) => (
            <Link key={a.id} href={`/instagram?account=${a.id}`} className="chip" data-tone={a.id === picked?.id ? "blue" : undefined}>
              @{a.username}
            </Link>
          ))}
        </div>
      )}
      <InstagramDashboard
        data={data}
        account={picked ? { ...picked } : DEMO_ACCOUNT}
        query={q}
        href={href}
        actions={
          <>
            {picked && <IgAccountActions accountId={picked.id} username={picked.username} />}
            {configured && connect}
          </>
        }
      />
    </>
  );
}
