import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";

export const metadata: Metadata = {
  title: "Terms of Service | Sithelo",
  description: "Terms governing use of the Sithelo platform.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main>
      <SiteNav />
      <section className="max-w-[760px] mx-auto px-8 pt-6 pb-20">
        <h1 className="text-3xl font-display font-bold tracking-tight text-navy mb-2">Terms of Service</h1>
        <p className="text-sm text-ink-600 mb-8">Last updated: [DATE, to be set on legal review]</p>

        <div className="card bg-champagne/10 border-champagne/40 mb-10">
          <p className="text-sm text-ink-600 leading-relaxed">
            <strong className="text-navy">Draft placeholder.</strong> This page is structural scaffolding,
            not a reviewed legal document. Bracketed fields must be completed and the full text reviewed
            by a qualified lawyer before this page is relied on in production.
          </p>
        </div>

        <div className="space-y-8 text-[15px] text-ink-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">1. Who these terms cover</h2>
            <p>
              These Terms of Service govern access to and use of the Sithelo platform by entrepreneurs,
              institutions and administrators. By registering an account, you agree to these terms.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">2. The company</h2>
            <p>
              Sithelo is operated by Sithelo Group Holdings (Pty) Ltd, registered in [REGISTRATION DETAILS], with its
              registered address at [PHYSICAL ADDRESS]. <em>[Placeholder: confirm registration
              number and address before launch.]</em>
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">3. The Business Passport</h2>
            <p>
              The Business Passport reflects verification and document status as submitted and confirmed
              through the platform. Sithelo does not guarantee funding, procurement contracts, business
              growth, opportunity matching or compliance outcomes for any user.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">4. Accounts and accuracy</h2>
            <p>
              Users are responsible for the accuracy of information and documents they submit. Submitting
              false or misleading information for verification purposes may result in account suspension.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">5. Governing law</h2>
            <p>
              These terms are governed by the laws of [GOVERNING LAW, expected: Republic of South Africa].
              <em> [Placeholder: confirm with legal counsel.]</em>
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">6. Contact</h2>
            <p>
              Questions about these terms can be directed to [CONTACT EMAIL, not yet published].
            </p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
