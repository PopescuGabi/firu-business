import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { LogoMark } from "@/components/logo";
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
          <a href="/api/auth/google" className={buttonClass("filled", "lg")}>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
              <path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
              <path fill="#fff" opacity=".7" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6L6.4 14Z" />
              <path fill="#fff" opacity=".55" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" />
            </svg>
            Continue with Google
          </a>
          {env.devLoginEnabled() && (
            <form action="/api/auth/dev" method="post">
              <button className={buttonClass("gray", "lg") + " w-full"}>Developer sign-in (local only)</button>
            </form>
          )}
        </div>
        <p className="mt-6 text-[12px] text-label-2">
          Signing in also connects Google Calendar and Drive, so your organiser and files work on every device.
        </p>
        <p className="mt-3 text-[12px] text-label-2">
          <a href="/privacy" className="hover:text-label">Privacy</a> · <a href="/terms" className="hover:text-label">Terms</a>
        </p>
      </div>
    </main>
  );
}
