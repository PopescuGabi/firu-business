import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { LogoMark } from "@/components/logo";
import { GoogleButton } from "@/components/google-button";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "This Google account isn't allowed to open this site.",
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
      <div className="w-full max-w-sm text-center">
        <LogoMark size={72} className="mx-auto mb-5" />
        <h1 className="text-[28px] font-bold tracking-tight">Personal Hub</h1>
        <p className="mt-1 text-[15px] text-label-2">Private. Only you can sign in.</p>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red/12 px-4 py-3 text-[14px] text-red">
            {ERRORS[error] ?? "Sign-in failed."}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <GoogleButton label="Continue with Google" />
          {env.devLoginEnabled() && (
            <form action="/api/auth/dev" method="post">
              <button className={buttonClass("gray", "lg") + " w-full"}>Developer sign-in (local only)</button>
            </form>
          )}
        </div>
        <p className="mt-6 text-[12px] text-label-2">
          Signing in also connects Google Calendar (to plan around your events and add the blocks you accept) and Google Drive
          (only the files this app creates). <a href="/welcome" className="text-blue">What is Personal Hub?</a>
        </p>
        <p className="mt-3 text-[12px] text-label-2">
          <a href="/privacy" className="hover:text-label">Privacy</a> · <a href="/terms" className="hover:text-label">Terms</a>
        </p>
      </div>
    </main>
  );
}
