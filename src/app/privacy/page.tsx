import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="3 November 2026">
      <p>
        Personal Hub is a personal organiser. It is invite only: its owner invites people by their Google account, and only
        those accounts can sign in. Each person has their own private hub; nobody else, including the owner, can see what you
        store in yours.
      </p>

      <h2>Google data it accesses, and why</h2>
      <ul>
        <li>
          <strong>Basic profile (name, email, picture):</strong> to sign you in, check that your account was invited, and show
          your name.
        </li>
        <li>
          <strong>Google Calendar, read-only (calendar.readonly):</strong> to show your events and plan study, gym and
          project time around them, and to warn when sessions are too close for the travel between them.
        </li>
        <li>
          <strong>Google Calendar events (calendar.events):</strong> to add, edit and delete events when you do so on the
          Calendar page, and, when you turn on calendar sync, to keep your school classes, gym, tutoring, accepted plan blocks
          and task due dates in a &ldquo;Personal Hub&rdquo; calendar you create and bring the changes you make to those events
          back into the app. It never changes an event unless you ask it to, or it is one the app manages in that calendar.
        </li>
        <li>
          <strong>Google Drive, app files only (drive.file):</strong> to create a &ldquo;Personal Hub&rdquo; folder and save the
          files you upload or export there. It can&apos;t see or change any other file in your Drive.
        </li>
        <li>
          <strong>Gmail (gmail.readonly, gmail.send), only if you connect it:</strong> asked for separately, when you turn on
          the Email section. To list your inbox, show an email you open (as plain text), turn an email into a task, and send
          the replies you write and send yourself. Emails are read when a page needs them and aren&apos;t stored, apart from
          the subject and a link in tasks you create from them. The app never sends anything you didn&apos;t write and send.
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
        If you add your own Anthropic API key, then when you ask for an AI week plan the times and titles of your calendar
        events and your schedule are sent to Anthropic&apos;s Claude API to generate suggestions, and when you ask the AI
        editor for help the text of that reel or carousel and your saved prompts are sent. This only happens when you request
        it, and email content is never sent to AI. Google user data is not used to
        develop, improve or train generalised AI or machine-learning models, and Anthropic doesn&apos;t train models on API
        requests by default.
      </p>

      <h2>Your public portfolio page</h2>
      <p>
        If you turn on your portfolio share link, visits to it are counted so you can see how many people look and
        which pieces they open. For each visit only the day, the piece opened and the website the visitor came from
        (for example instagram.com) are stored. No IP address, no cookies, nothing that identifies the visitor.
      </p>

      <h2>Google Maps (optional)</h2>
      <p>
        If you add your own Google Maps API key, the addresses you save for your places (home, school, gym, tutoring) are
        stored in your hub and sent to Google Maps Platform with your key to search addresses, work out travel times and
        draw your route. That use is billed to your own Google Cloud project and covered by Google&apos;s terms. When you
        ask for AI route advice, only your place names, schedule and travel minutes go to Claude, never the addresses. You
        can remove any address, or the key, in Settings at any time.
      </p>

      <h2>Where data is stored</h2>
      <p>
        What you store in your hub (schedule, tasks, clients, reels, carousels, prompts, notes) is kept in Personal Hub&apos;s
        database, separated per person. Google sign-in tokens and your Anthropic and Google Maps keys are encrypted (AES-256-GCM). Files stay
        in your own Google Drive. Calendar events and emails are read when a page needs them and aren&apos;t stored, except
        the events this app created itself.
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
        . Everything you store can be deleted inside the app, and Settings → Delete account removes your account and all of
        its data at once and disconnects Google. Files in your Drive and events in your calendar stay yours. You can also ask
        for deletion via the support email shown on the Google sign-in screen; it&apos;s done within 30 days.
      </p>
    </LegalPage>
  );
}
