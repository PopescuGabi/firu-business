import Link from "next/link";
import { AiSetup } from "@/components/ai-setup";
import { buttonClass, Card, PageHeader } from "@/components/ui";
import { claudeAvailable } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { todayIn } from "@/lib/week";

export const metadata = { title: "Set up with AI" };

/** Settings → Set up with AI: answer again; it only adds pages and never deletes what you have. */
export default async function SetupPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const ai = await claudeAvailable(user.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Set up with AI" subtitle="Settings" />
      {ai ? (
        <AiSetup current={user.modules} today={todayIn(settings.timezone)} />
      ) : (
        <Card className="flex flex-col items-start gap-3 p-5 text-[15px]">
          <p>Claude isn&apos;t set up in this hub yet, so the AI setup can&apos;t run. You can still turn sections on in Settings.</p>
          <Link href="/settings#sections" className={buttonClass("gray", "sm")}>
            Back to Settings
          </Link>
        </Card>
      )}
    </div>
  );
}
