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
    <main id="main-content">
      <SiteNav />
      <section className="max-w-[760px] mx-auto px-8 pt-6 pb-20">
        <h1 className="text-3xl font-display font-medium tracking-tight text-navy mb-2">Privacy Policy</h1>
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
            <h2 className="text-lg font-display font-semibold text-navy mb-2">4. Third parties we use</h2>
            <p className="mb-2">Sithelo relies on the following external services to operate:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-navy">Supabase</strong> — hosts our database, authentication and document storage. This is where account details, business information and uploaded verification documents are stored.</li>
              <li><strong className="text-navy">Resend</strong> — delivers transactional emails (e.g. account and notification emails) on our behalf.</li>
              <li><strong className="text-navy">Google Fonts</strong> — our pages load typefaces directly from Google&apos;s font servers, which means your browser sends a request (including your IP address) to Google when a page loads. This is standard font-delivery behaviour, not analytics or advertising tracking.</li>
            </ul>
            <p className="mt-2">
              Sithelo does not currently use any analytics, advertising or behavioural-tracking
              services, and does not sell or share personal information with third parties for
              marketing purposes. An AI text-generation feature and WhatsApp notifications exist in
              the codebase but are not active in the product today; this policy will be updated
              before either is switched on for real users.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">5. Cookies</h2>
            <p>
              Sithelo only sets the strictly necessary cookies your browser needs to keep you logged
              in (managed by Supabase Auth). We don&apos;t use analytics, advertising or
              preference-tracking cookies, so there&apos;s currently nothing on the site that requires
              a cookie-consent banner under South African or comparable rules. If that changes, this
              section and the consent mechanism will be updated together.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">6. Data retention and your rights</h2>
            <p>
              [PLACEHOLDER: retention periods, deletion process and POPIA data-subject rights to be
              confirmed on legal review.]
            </p>
          </section>
          <section>
            <h2 className="text-lg font-display font-semibold text-navy mb-2">7. Contact</h2>
            <p>Questions about this policy can be directed to [CONTACT EMAIL, not yet published].</p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
