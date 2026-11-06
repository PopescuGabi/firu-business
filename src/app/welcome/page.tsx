import Link from "next/link";
import { BarChart3, Briefcase, CalendarDays, Clapperboard, FolderOpen, LayoutGrid, Mail, Route, ShieldCheck } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { DRIVE_ROOT_NAME } from "@/lib/google/drive";
import { GoogleButton } from "@/components/google-button";
import { LogoMark } from "@/components/logo";

export const metadata = {
  title: { absolute: `${APP_NAME}: your marketing workspace` },
  description: `${APP_NAME} keeps your clients, content, Instagram results and week in one place, with a dashboard for every client.`,
};

const FEATURES = [
  {
    icon: Briefcase,
    title: "Every client, only what they need",
    text: "Each client gets the tools their business uses: Instagram analytics, content, app work or finance. Nothing extra.",
  },
  {
    icon: BarChart3,
    title: "Instagram analytics",
    text: "Reach, views, followers, best posts and formats, and how often you post, straight from Instagram's official API.",
  },
  {
    icon: Clapperboard,
    title: "Content production",
    text: "Reels and carousels per client, with an AI editor that follows your style, and what's waiting on review.",
  },
  {
    icon: LayoutGrid,
    title: "A dashboard for your clients",
    text: "Invite a client and they see their own results and the work you share with them, nothing else.",
  },
  {
    icon: Route,
    title: "A week plan that fits",
    text: "Plans client work into your free time around your calendar, and never puts two meetings closer than the trip between them.",
  },
  {
    icon: CalendarDays,
    title: "Works with Google Calendar",
    text: "Reads your calendars so plans go around what's already there, and adds the blocks you accept.",
  },
  {
    icon: FolderOpen,
    title: "Files in Google Drive",
    text: `Footage, screenshots and exported carousel slides are saved in a “${DRIVE_ROOT_NAME}” folder in your Drive.`,
  },
  {
    icon: Mail,
    title: "Email, if you want it",
    text: "Connect Gmail to see unread mail on Home, reply, and turn an email into a task in one click.",
  },
];

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <header className="text-center">
        <LogoMark size={72} className="mx-auto" />
        <h1 className="mt-5 text-[34px] leading-tight font-bold tracking-tight sm:text-[44px]">{APP_NAME}</h1>
        <p className="mx-auto mt-3 max-w-xl text-[17px] text-label-2">
          {APP_TAGLINE}
        </p>
        <div className="mx-auto mt-7 max-w-xs">
          <GoogleButton />
          <p className="mt-2 text-[12px] text-label-2">Invite only: sign in with the Google account you were invited with.</p>
        </div>
      </header>

      <section className="mt-14 grid gap-4 sm:grid-cols-2" aria-label="What it does">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass rounded-[24px] p-5">
            <Icon size={22} className="text-blue" />
            <h2 className="mt-3 text-[17px] font-semibold">{title}</h2>
            <p className="mt-1 text-[15px] text-label-2">{text}</p>
          </div>
        ))}
      </section>

      <section className="glass mt-12 rounded-[24px] p-6" aria-labelledby="google-data">
        <h2 id="google-data" className="flex items-center gap-2 text-[19px] font-semibold">
          <ShieldCheck size={20} className="text-green" /> How it uses your Google data
        </h2>
        <ul className="mt-3 space-y-2 text-[15px] [&_li]:ml-5 [&_li]:list-disc">
          <li>
            <strong>Calendar (read):</strong> shows your events and plans client work around them.
          </li>
          <li>
            <strong>Calendar events (create/edit/delete):</strong> adds, edits or deletes events only when you do so in the
            app, plus the work blocks you accept.
          </li>
          <li>
            <strong>Drive (files it creates):</strong> saves uploads and exports in its own folder. It can&apos;t see the rest
            of your Drive.
          </li>
          <li>
            <strong>Gmail (only if you connect it):</strong> lists and shows your mail, and sends only the replies you write
            and send.
          </li>
        </ul>
        <p className="mt-3 text-[15px] text-label-2">
          Nothing is sold, shared for advertising, or used to train AI models. Read the full{" "}
          <Link href="/privacy" className="font-semibold text-blue">
            privacy policy
          </Link>
          .
        </p>
      </section>

      <footer className="mt-10 text-center text-[13px] text-label-2">
        <Link href="/privacy" className="hover:text-label">Privacy policy</Link> ·{" "}
        <Link href="/terms" className="hover:text-label">Terms</Link>
      </footer>
    </main>
  );
}
