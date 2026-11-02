import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms", robots: { index: false, follow: false } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="3 November 2026">
      <p>
        Personal Hub is a private tool for its owner only. Access is limited to one Google account; there is no public sign-up,
        and no service is offered to anyone else.
      </p>
      <p>It&apos;s provided as is, without warranties. The owner may change or shut it down at any time.</p>
      <p>
        See the <a href="/privacy" className="text-blue">privacy policy</a> for what data it uses.
      </p>
    </LegalPage>
  );
}
