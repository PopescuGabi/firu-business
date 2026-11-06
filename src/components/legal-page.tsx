import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { LogoMark } from "./logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/login" className="mb-8 flex items-center gap-2 text-[15px] font-semibold">
        <LogoMark size={22} /> {APP_NAME}
      </Link>
      <h1 className="text-[34px] font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-[13px] text-label-2">Last updated {updated}</p>
      <div className="glass mt-8 space-y-5 rounded-[24px] p-6 sm:p-8 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2:first-child]:mt-0 [&_h2]:text-[19px] [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  );
}
