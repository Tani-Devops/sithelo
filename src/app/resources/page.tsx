import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";

export const metadata: Metadata = {
  title: "Resources | Sithelo",
  description:
    "Explainers on the Business Passport, verification and procurement-readiness for South African entrepreneurs and institutions.",
  alternates: { canonical: "/resources" },
};

const TOPICS = [
  {
    title: "What is a Business Passport?",
    body: "A Business Passport is a single, verified credential built from real checks (CIPC, SARS, VAT, B-BBEE, CIDB and more) rather than a self-reported profile. Instead of assembling proof of compliance for every application, an entrepreneur builds it once and it travels with them.",
  },
  {
    title: "Why business verification matters for procurement",
    body: "Procurement and enterprise development decisions carry real risk when compliance status is unclear. Verified CIPC, SARS, VAT and B-BBEE status gives institutions a defensible basis for shortlisting, instead of relying on documents supplied and self-certified late in a process.",
  },
  {
    title: "How SMEs can become procurement-ready",
    body: "Procurement-readiness usually comes down to the same handful of gaps: CIPC registration status, tax compliance (SARS/VAT), B-BBEE certification, and, for construction and built-environment work, CIDB grading. Working through verification types one at a time, in that order, is typically the fastest path to being shortlist-eligible.",
  },
  {
    title: "What institutions need to know before engaging an SME",
    body: "Beyond compliance documents, institutions generally need to understand a business's sector, location (province and municipality), trading history and current verification status before due diligence can move forward. A verified Passport surfaces all of this in one place instead of scattered across email threads.",
  },
  {
    title: "Building a more accessible opportunity economy for South African entrepreneurs",
    body: "Opportunity access shouldn't depend on who an entrepreneur already knows or how well-resourced their business is to navigate paperwork. Portable, verifiable credentials are one way to lower that barrier, letting institutions evaluate businesses on real, comparable data.",
  },
];

export default function ResourcesPage() {
  return (
    <main>
      <SiteNav />
      <section className="max-w-[820px] mx-auto px-8 pt-6 pb-20">
        <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">Resources</div>
        <h1 className="text-4xl font-display font-bold tracking-tight text-navy mb-10">
          Understanding verification and opportunity access
        </h1>
        <div className="space-y-10">
          {TOPICS.map((t) => (
            <article key={t.title} className="border-b border-line pb-10 last:border-0">
              <h2 className="text-xl font-display font-semibold text-navy mb-3">{t.title}</h2>
              <p className="text-[15px] text-ink-600 leading-relaxed">{t.body}</p>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
