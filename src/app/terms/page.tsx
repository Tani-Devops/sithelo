import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { LEGAL_CONFIG } from "@/lib/legal/config";

export const metadata: Metadata = {
  title: "Terms of Service | Sithelo",
  description: "Terms governing use of the Sithelo platform.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/terms" },
};

// ====================================================================
// No bracketed placeholders or developer notes are rendered to the
// public here. Where a legal fact (registered entity name, registration
// number, physical address, governing-law position, contact mailbox)
// has not actually been confirmed anywhere in this codebase or its
// environment, this page says so in plain prose rather than inventing
// one — see src/lib/legal/config.ts. Everything else below describes
// how the platform actually works today, not aspirational policy.
// ====================================================================

export default function TermsPage() {
  const c = LEGAL_CONFIG;
  return (
    <main id="main-content">
      <SiteNav />
      <section className="max-w-[760px] mx-auto px-8 pt-6 pb-20">
        <h1 className="text-3xl font-display font-medium tracking-tight text-navy mb-2">Terms of Service</h1>
        <p className="text-sm text-ink-600 mb-10">
          {c.lastUpdated ? `Last updated: ${c.lastUpdated}` : "This policy has not yet completed legal review."}
        </p>

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
              {c.companyName
                ? `Sithelo is operated by ${c.companyName}${c.registrationNumber ? ` (registration number ${c.registrationNumber})` : ""}${c.address ? `, with its registered address at ${c.address}` : ""}.`
                : "Sithelo's full registered company details will be published here before public launch."}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">3. The Business Passport</h2>
            <p>
              The Business Passport reflects information submitted by a business and reviewed through
              Sithelo. Verification status shown on a Passport reflects information currently reviewed
              through Sithelo, not an automatic check against CIPC, SARS, CIDB, B-BBEE or other government
              systems, unless a specific integration is stated otherwise on the platform. Sithelo does not
              guarantee funding, procurement contracts, business growth, opportunity matching or compliance
              outcomes for any user.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">4. Accounts and accuracy</h2>
            <p>
              Users are responsible for the accuracy of information and documents they submit. Submitting
              false or misleading information for verification purposes may result in account suspension.
              Institution accounts are responsible for the accuracy of opportunities they publish and for
              handling applicant information only for the purposes of evaluating that application.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">5. Prohibited activity</h2>
            <p>
              Users may not attempt to access accounts, businesses, institutions or documents that are not
              their own; misrepresent their identity, role or business; upload fraudulent verification
              documents; or use the platform to circumvent the access controls described in Sithelo&apos;s
              Privacy Policy.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">6. Platform availability</h2>
            <p>
              Sithelo is provided on an &quot;as available&quot; basis. Features may change, and the
              platform may occasionally be unavailable for maintenance. Sithelo is not liable for losses
              arising from downtime, data loss, or reliance on unverified or in-progress information shown
              on the platform, to the fullest extent permitted by law.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">7. Governing law</h2>
            <p>
              {c.governingLaw
                ? `These terms are governed by the laws of ${c.governingLaw}.`
                : "The governing law for these terms will be confirmed and published here before public launch."}
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">8. Contact</h2>
            <p>
              {c.contactEmail
                ? <>Questions about these terms can be directed to <a className="text-navy underline underline-offset-2" href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>.</>
                : "A monitored contact address for questions about these terms will be published here before public launch."}
            </p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
