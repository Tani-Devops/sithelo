import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";

export const metadata: Metadata = {
  title: "About | Sithelo",
  description:
    "Sithelo is business opportunity infrastructure for South Africa: a verified Business Passport that helps entrepreneurs turn effort into results.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content" className="bg-linen text-midnight">
      <section aria-labelledby="hero-heading" className="m-container pt-12 md:pt-16 pb-20 md:pb-24">
        <div className="max-w-[68ch]">
          <h1 id="hero-heading" className="font-display font-medium text-m-section text-midnight max-w-[18ch]">
            Helping entrepreneurs turn effort into results.
          </h1>
          <p className="m-lead mt-6">Business opportunity infrastructure for South Africa.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto whitespace-nowrap">I&apos;m an entrepreneur</Link>
            <Link href="/register?role=institution" className="m-btn-glass w-full sm:w-auto whitespace-nowrap">I&apos;m an institution</Link>
          </div>
        </div>
      </section>

      <section aria-label="About Sithelo" className="bg-linen-deep">
        <div className="m-container py-20 md:py-28">
          <div className="max-w-[68ch] space-y-6 text-[1.0625rem] text-ink-700 leading-relaxed">
            <p>
              Capable, compliant South African businesses exist in every province and every industry,
              but effort alone doesn&apos;t always translate into opportunity. Verification is scattered
              across documents, institutions can&apos;t easily tell who is genuinely ready, and
              entrepreneurs often rebuild the same proof of credibility from scratch for every
              application, tender or funding conversation.
            </p>
            <p>
              Sithelo exists to close that gap. It is not a job board, a CRM or a general business
              directory. It is infrastructure: a verified, portable credential, the{" "}
              <strong className="text-midnight">Business Passport™</strong>, that an entrepreneur builds
              once and carries into every opportunity they pursue.
            </p>

            <h2 className="font-display font-medium text-m-title text-midnight pt-6">What the Business Passport does</h2>
            <p>
              A Business Passport brings together the verification types that matter for procurement,
              funding and enterprise development in South Africa (CIPC, SARS, VAT, banking, B-BBEE,
              insurance, CIDB and Municipal Supplier Database status) into a single trust score. That
              score is never entered by hand; it&apos;s calculated from actual verification, document and
              track-record data, so it can&apos;t drift from reality.
            </p>

            <h2 className="font-display font-medium text-m-title text-midnight pt-6">Who it&apos;s for</h2>
            <p>
              <strong className="text-midnight">Entrepreneurs</strong> build and maintain their Business
              Passport, upload supporting documents, and apply to opportunities with a credential
              institutions can trust on sight.
            </p>
            <p>
              <strong className="text-midnight">Institutions</strong> (funders, enterprise development
              programmes, procurement teams and corporate partners) search and shortlist verified,
              capacity-ready businesses instead of starting due diligence from zero every time.
            </p>

            <h2 className="font-display font-medium text-m-title text-midnight pt-6">Why this matters</h2>
            <p>
              South Africa&apos;s opportunity economy depends on institutions being able to say yes with
              confidence, and on entrepreneurs not being shut out because verification is slow,
              expensive or fragmented. Sithelo is built to make that connection faster and more honest
              on both sides, with no shortcuts on compliance and no guesswork on readiness.
            </p>
          </div>
        </div>
      </section>
      </main>
      <SiteFooter />
    </>
  );
}
