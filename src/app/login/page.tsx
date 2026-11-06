import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import { LogoMark } from "@/components/logo";
import { GoogleButton } from "@/components/google-button";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "Google couldn't confirm this account's email address.",
  not_invited: "FIRU Business is invite only. Ask the owner to invite this Google account, then try again.",
  invalid_state: "The sign-in link expired. Please try again.",
  google_denied: "Google sign-in was cancelled.",
  oauth_failed: "Google sign-in failed. Please try again.",
  google_not_configured: "Google sign-in isn't set up yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="glass w-full max-w-sm rounded-[28px] px-6 py-9 text-center">
        <LogoMark size={72} className="mx-auto mb-5" />
        <h1 className="text-[28px] font-bold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-[15px] text-label-2">Your own private hub. Invite only.</p>

        {error && (
          <p role="alert" className="mt-5 rounded-2xl bg-red/12 px-4 py-3 text-[14px] text-red">
            {ERRORS[error] ?? "Sign-in failed."}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <GoogleButton label="Continue with Google" />
          {env.devLoginEnabled() && (
            <form action="/api/auth/dev" method="post" className="flex gap-2">
              <input name="email" type="email" placeholder="Owner, or an invited email" aria-label="Email to sign in as" className="field" />
              <button className={buttonClass("gray", "lg") + " shrink-0"}>Dev sign-in</button>
            </form>
          )}
        </div>
        <p className="mt-6 text-[12px] text-label-2">
          Signing in also connects Google Calendar (to plan around your events and add the blocks you accept) and Google Drive
          (only the files this app creates). <a href="/welcome" className="text-blue">What is FIRU Business?</a>
        </p>
        <p className="mt-3 text-[12px] text-label-2">
          <a href="/privacy" className="hover:text-label">Privacy</a> · <a href="/terms" className="hover:text-label">Terms</a>
        </p>
      </div>
    </main>
  );
}
