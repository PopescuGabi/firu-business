import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="3 November 2026">
      <p>
        Personal Hub is a private organiser used by one person, its owner. Only the owner&apos;s Google account can sign in;
        nobody else can create an account or use it.
      </p>

      <h2>Google data it accesses, and why</h2>
      <ul>
        <li>
          <strong>Basic profile (name, email, picture):</strong> to confirm that the person signing in is the owner.
        </li>
        <li>
          <strong>Google Calendar, read-only (calendar.readonly):</strong> to show your events and plan study, gym and
          project time around them, and to warn when sessions are too close for the travel between them.
        </li>
        <li>
          <strong>Google Calendar events (calendar.events):</strong> when you turn on calendar sync, to keep your school
          classes, gym, tutoring, accepted plan blocks and task due dates in a &ldquo;Personal Hub&rdquo; calendar you create,
          and to bring the changes you make to those events (moving, renaming, deleting) back into the app. It doesn&apos;t
          change other events.
        </li>
        <li>
          <strong>Google Drive, app files only (drive.file):</strong> to create a &ldquo;Personal Hub&rdquo; folder and save the
          files you upload or export there. It can&apos;t see or change any other file in your Drive.
        </li>
      </ul>

      <h2>Limited Use</h2>
      <p>
        Personal Hub&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Google data is only used to provide the features you see in the app. It
        is never sold, never used for advertising, never used to determine credit-worthiness, and never read by people,
        except with your permission, for security, or where the law requires it.
      </p>

      <h2>AI features</h2>
      <p>
        When you ask for an AI week plan, the times and titles of your calendar events and your schedule are sent to
        Anthropic&apos;s Claude API to generate suggestions; when you ask the AI editor for help, the text of that reel or
        carousel and your saved prompts are sent. This only happens when you request it. Google user data is not used to
        develop, improve or train generalised AI or machine-learning models, and Anthropic doesn&apos;t train models on API
        requests by default.
      </p>

      <h2>Where data is stored</h2>
      <p>
        The organiser&apos;s own data (schedule, tasks, clients, reels, carousels, prompts, notes) is stored in the owner&apos;s
        private database. Google sign-in tokens are encrypted (AES-256-GCM). Files stay in the owner&apos;s Google Drive.
        Calendar events are read when a page needs them and aren&apos;t stored, except the events this app created itself.
      </p>

      <h2>Sharing</h2>
      <p>
        Nothing is shared with anyone else, apart from the AI requests described above and the portfolio items you choose
        to publish. Portfolio items are private by default. When you mark one as public and turn on your public portfolio
        page, its title, description, client name, date and tags appear on that page (at an address only you hand out),
        and its files in your Drive get a view-only link so visitors can see them. Making the item private again removes
        those links; turning the page off hides the page.
      </p>

      <h2>Removing access and deleting data</h2>
      <p>
        You can revoke access at any time at{" "}
        <a href="https://myaccount.google.com/permissions" className="text-blue">
          myaccount.google.com/permissions
        </a>
        . Tasks, reels, carousels, app updates, prompts, feedback and plan blocks can be deleted inside the app; anything else
        is deleted on request via the support email shown on the Google sign-in screen, within 30 days.
      </p>
    </LegalPage>
  );
}
