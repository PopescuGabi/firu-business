import Link from "next/link";
import { CalendarDays, Clapperboard, FolderOpen, GraduationCap, LayoutGrid, Mail, Route, ShieldCheck, Sparkles } from "lucide-react";
import { GoogleButton } from "@/components/google-button";
import { LogoMark } from "@/components/logo";

export const metadata = {
  title: { absolute: "Personal Hub: your own organiser, built around how you work" },
  description:
    "Personal Hub plans your week around your calendar and travel time, with the sections you need: school, gym, client work, portfolio and email.",
};

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Only the sections you need",
    text: "A student turns on School and Gym; a freelancer turns on clients, portfolio and email. Change it any time.",
  },
  {
    icon: GraduationCap,
    title: "School, tutoring and gym",
    text: "Your timetable, tutoring sessions and gym split in one view, with the time each needs.",
  },
  {
    icon: Route,
    title: "A week plan that respects travel time",
    text: "Suggests when to study, train and work, and never puts two things closer together than the trip between them.",
  },
  {
    icon: CalendarDays,
    title: "Works with Google Calendar",
    text: "Reads your calendars so plans go around what's already there, and adds the blocks and sessions you accept.",
  },
  {
    icon: FolderOpen,
    title: "Files in Google Drive",
    text: "Footage, screenshots and exported carousel slides are saved in a “Personal Hub” folder in your Drive.",
  },
  {
    icon: Clapperboard,
    title: "Client workspace",
    text: "App updates, reels and carousels per client, with client feedback notes and what's waiting on review.",
  },
  {
    icon: Mail,
    title: "Email, if you want it",
    text: "Connect Gmail to see unread mail on Home, reply, and turn an email into a task in one click.",
  },
  {
    icon: Sparkles,
    title: "AI editor and planner",
    text: "With your own Claude key, Claude suggests edits and week plans; you review and apply every change yourself.",
  },
];

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <header className="text-center">
        <LogoMark size={72} className="mx-auto" />
        <h1 className="mt-5 text-[34px] leading-tight font-bold tracking-tight sm:text-[44px]">Personal Hub</h1>
        <p className="mx-auto mt-3 max-w-xl text-[17px] text-label-2">
          Your own private organiser: your calendar, tasks and the sections you choose, planned around real travel time.
        </p>
        <div className="mx-auto mt-7 max-w-xs">
          <GoogleButton />
          <p className="mt-2 text-[12px] text-label-2">Invite only: sign in with the Google account you were invited with.</p>
        </div>
      </header>

      <section className="mt-14 grid gap-4 sm:grid-cols-2" aria-label="What it does">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl bg-card p-5 shadow-apple">
            <Icon size={22} className="text-blue" />
            <h2 className="mt-3 text-[17px] font-semibold">{title}</h2>
            <p className="mt-1 text-[15px] text-label-2">{text}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 rounded-2xl bg-card p-6 shadow-apple" aria-labelledby="google-data">
        <h2 id="google-data" className="flex items-center gap-2 text-[19px] font-semibold">
          <ShieldCheck size={20} className="text-green" /> How it uses your Google data
        </h2>
        <ul className="mt-3 space-y-2 text-[15px] [&_li]:ml-5 [&_li]:list-disc">
          <li>
            <strong>Calendar (read):</strong> shows your events and plans study, gym and project time around them.
          </li>
          <li>
            <strong>Calendar events (create/edit/delete):</strong> adds, edits or deletes events only when you do so in the
            app, plus the blocks and sessions you accept.
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
