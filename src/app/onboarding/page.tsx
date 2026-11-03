import { LogoMark } from "@/components/logo";
import { SectionsForm } from "@/components/sections-form";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Welcome" };

/** First sign-in: choose what you use the hub for. */
export default async function OnboardingPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const first = (user.name ?? "").split(" ")[0];
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      <LogoMark size={44} />
      <h1 className="mt-5 text-[34px] leading-tight font-bold tracking-tight">Welcome{first ? `, ${first}` : ""}</h1>
      <p className="mt-2 mb-8 text-[16px] text-label-2">What do you want Personal Hub for? Pick a starting point; it only shows the sections you choose.</p>
      <SectionsForm initial={user.modules.length ? user.modules : []} onboarding name={settings.displayName || first} timezone={user.onboarded ? settings.timezone : ""} />
    </main>
  );
}
