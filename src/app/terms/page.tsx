import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms", robots: { index: false, follow: false } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="3 November 2026">
      <p>
        Personal Hub is a personal organiser run by its owner for the people they invite. There is no public sign-up: only
        invited Google accounts can use it, and the owner can remove an account at any time. You can delete your own
        account in Settings.
      </p>
      <p>
        It&apos;s provided free, as is, without warranties. The owner may change or shut it down at any time. AI features run on
        the hub&apos;s Anthropic API key, with a monthly allowance per person set by the owner; you&apos;re responsible for what you send with Gmail.
      </p>
      <p>
        See the <a href="/privacy" className="text-blue">privacy policy</a> for what data it uses.
      </p>
    </LegalPage>
  );
}
