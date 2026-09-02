import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";

export const metadata: Metadata = {
  title: "Privacy Policy | Sithelo",
  description: "How Sithelo collects, uses and protects personal and business information.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main>
      <SiteNav />
      <section className="max-w-[760px] mx-auto px-8 pt-6 pb-20">
        <h1 className="text-3xl font-display font-bold tracking-tight text-navy mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink-600 mb-8">Last updated: [DATE, to be set on legal review]</p>

        <div className="card bg-champagne/10 border-champagne/40 mb-10">
          <p className="text-sm text-ink-600 leading-relaxed">
            <strong className="text-navy">Draft placeholder, high priority before launch.</strong> Sithelo
            collects personal and business information, so this page needs POPIA-aware legal review
            before going live. This draft is structured around how the platform actually classifies
            and protects data today, not invented policy.
          </p>
        </div>

        <div className="space-y-8 text-[15px] text-ink-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">1. Information we collect</h2>
            <p className="mb-2">Depending on your role, Sithelo collects:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information: name, email address, cell number, password (stored hashed via Supabase Auth).</li>
              <li>Business information: business name, type, industry, province/municipality, description, services, employee count, years trading.</li>
              <li>Verification documents: CIPC, SARS, VAT, banking, B-BBEE, insurance, CIDB and municipal supplier documentation, uploaded to a private document store.</li>
              <li>Owner-private business details: business email/phone, head office address, key clients, annual turnover.</li>
              <li>For entrepreneurs who complete the onboarding wizard: approximate, self-reported household and financial context (used only to shape guidance shown to that entrepreneur, never exact figures, never institution-visible).</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">2. Who can see what</h2>
            <p>
              Business identity and verification-status fields become visible to institutions once a
              Business Passport is published. Owner-private details (contact information, address,
              turnover) are only unlocked to an institution once a real interaction (a shortlist or
              application) connects that institution to your business, and that access is logged.
              Uploaded documents themselves are never shown to institutions directly; only the
              verification status derived from them is. Personal/household context from the onboarding
              wizard is visible only to you and platform administrators; it is never shared with
              institutions under any circumstance.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">3. How we use information</h2>
            <p>
              To operate your account, calculate your trust score from real verification data, match
              published Business Passports to relevant opportunities, and allow authorized institutions
              to conduct due diligence.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">4. Data retention and your rights</h2>
            <p>
              [PLACEHOLDER: retention periods, deletion process and POPIA data-subject rights to be
              confirmed on legal review.]
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">5. Contact</h2>
            <p>Questions about this policy can be directed to [CONTACT EMAIL, not yet published].</p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
