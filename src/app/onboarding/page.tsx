import { LogoMark } from "@/components/logo";
import { OnboardingChoice } from "@/components/onboarding-choice";
import { claudeAvailable } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Welcome" };

/** First sign-in: tell the AI what you do (or pick sections yourself). */
export default async function OnboardingPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const first = (user.name ?? "").split(" ")[0];
  const ai = await claudeAvailable(user.id);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      <LogoMark size={44} />
      <h1 className="mt-5 text-[34px] leading-tight font-bold tracking-tight">Welcome{first ? `, ${first}` : ""}</h1>
      <p className="mt-2 mb-8 text-[16px] text-label-2">
        {ai ? "Tell us what you do and Personal Hub builds pages for your work." : "What do you want Personal Hub for? Pick a starting point; it only shows the sections you choose."}
      </p>
      <OnboardingChoice
        ai={ai}
        current={user.modules}
        name={settings.displayName || first}
        timezone={user.onboarded ? settings.timezone : ""}
        today={todayIn(settings.timezone)}
      />
    </main>
  );
}
