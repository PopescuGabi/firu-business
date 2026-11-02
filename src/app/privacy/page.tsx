import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy policy", robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="3 November 2026">
      <p>
        Personal Hub is a private organiser used by one person, its owner. Only the owner&apos;s Google account can sign in;
        nobody else can create an account or use it.
      </p>
      <h2>What it accesses in Google</h2>
      <ul>
        <li>Your name, email and profile picture, to confirm it&apos;s you.</li>
        <li>Your calendars and their events (read), to plan around them.</li>
        <li>Events it creates in your calendar (create and delete), for plan blocks and tutoring you choose to add.</li>
        <li>Only the Google Drive files and folders it creates itself (the &ldquo;Personal Hub&rdquo; folder). It can&apos;t see the rest of your Drive.</li>
      </ul>
      <h2>What it stores</h2>
      <p>
        The organiser&apos;s own data (schedule, tasks, clients, reels, carousels, prompts, notes) is stored in the owner&apos;s
        private database. Google sign-in tokens are encrypted. Files stay in the owner&apos;s Google Drive.
      </p>
      <h2>Sharing</h2>
      <p>
        Nothing is sold or shared. When the owner asks the built-in AI editor for help, the text of that reel or carousel and
        the owner&apos;s saved prompts are sent to Anthropic&apos;s Claude API to generate a reply.
      </p>
      <h2>Removing access</h2>
      <p>
        Access can be revoked at any time at myaccount.google.com → Security → Third-party apps. To have stored data deleted,
        contact the support email shown on the Google sign-in screen.
      </p>
    </LegalPage>
  );
}
