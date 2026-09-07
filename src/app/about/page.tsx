import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { SitheloButton } from "@/components/ui/sithelo";

export const metadata: Metadata = {
  title: "About | Sithelo",
  description:
    "Sithelo is business opportunity infrastructure for South Africa: a verified Business Passport that helps entrepreneurs turn effort into results.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main id="main-content">
      <SiteNav />
      <section className="max-w-[820px] mx-auto px-8 pt-6 pb-20">
        <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">About Sithelo</div>
        <h1 className="text-4xl font-display font-medium tracking-tight text-navy mb-6">
          Helping entrepreneurs turn effort into results.
        </h1>

        <div className="prose-none space-y-6 text-[15px] text-ink-600 leading-relaxed">
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
            <strong className="text-navy">Business Passport™</strong>, that an entrepreneur builds
            once and carries into every opportunity they pursue.
          </p>

          <h2 className="text-xl font-display font-semibold text-navy pt-2">What the Business Passport does</h2>
          <p>
            A Business Passport brings together the verification types that matter for procurement,
            funding and enterprise development in South Africa (CIPC, SARS, VAT, banking, B-BBEE,
            insurance, CIDB and Municipal Supplier Database status) into a single trust score. That
            score is never entered by hand; it&apos;s calculated from actual verification, document and
            track-record data, so it can&apos;t drift from reality.
          </p>

          <h2 className="text-xl font-display font-semibold text-navy pt-2">Who it&apos;s for</h2>
          <p>
            <strong className="text-navy">Entrepreneurs</strong> build and maintain their Business
            Passport, upload supporting documents, and apply to opportunities with a credential
            institutions can trust on sight.
          </p>
          <p>
            <strong className="text-navy">Institutions</strong> (funders, enterprise development
            programmes, procurement teams and corporate partners) search and shortlist verified,
            capacity-ready businesses instead of starting due diligence from zero every time.
          </p>

          <h2 className="text-xl font-display font-semibold text-navy pt-2">Why this matters</h2>
          <p>
            South Africa&apos;s opportunity economy depends on institutions being able to say yes with
            confidence, and on entrepreneurs not being shut out because verification is slow,
            expensive or fragmented. Sithelo is built to make that connection faster and more honest
            on both sides, with no shortcuts on compliance and no guesswork on readiness.
          </p>
        </div>

        <div className="flex gap-3 mt-10">
          <SitheloButton href="/register?role=entrepreneur">I&apos;m an Entrepreneur</SitheloButton>
          <SitheloButton variant="ghost" href="/register?role=institution">I&apos;m an Institution</SitheloButton>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
