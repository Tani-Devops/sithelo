import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { SitheloButton } from "@/components/ui/sithelo";

export const metadata: Metadata = {
  title: "For Institutions | Sithelo",
  description:
    "Search and shortlist verified, capacity-ready South African businesses through the Business Passport, with due diligence built in.",
  alternates: { canonical: "/for-institutions" },
};

const CAPABILITIES = [
  { title: "Search verified businesses", body: "Filter by industry, province, municipality and verification status instead of starting due diligence from a blank page." },
  { title: "Due diligence built in", body: "Every Passport surfaces real verification status across CIPC, SARS, VAT, B-BBEE, CIDB and more." },
  { title: "Post opportunities", body: "Create funding, procurement or enterprise development opportunities and receive applications from eligible, verified businesses." },
  { title: "Shortlist with confidence", body: "Compare businesses on trust score and verification status, not self-reported claims." },
];

export default function ForInstitutionsPage() {
  return (
    <main>
      <SiteNav />
      <section className="max-w-[1280px] mx-auto px-8 pt-6 pb-16">
        <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">For Institutions</div>
        <h1 className="text-4xl font-display font-bold tracking-tight text-navy mb-5 max-w-2xl">
          Find capacity-ready businesses you can trust.
        </h1>
        <p className="text-base text-ink-600 leading-relaxed max-w-xl mb-8">
          Sithelo gives funders, enterprise development programmes, procurement teams and corporate
          partners a faster path to verified, ready-to-work South African businesses.
        </p>
        <SitheloButton href="/register?role=institution">Request a Demo</SitheloButton>
      </section>

      <section className="max-w-[1280px] mx-auto px-8 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="card">
              <h3 className="text-lg font-display font-semibold text-navy mb-2">{c.title}</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ivory py-16">
        <div className="max-w-[1280px] mx-auto px-8">
          <h2 className="text-2xl font-display font-bold text-navy mb-3">Nationwide coverage</h2>
          <p className="text-ink-600 text-[15px] max-w-lg">
            Businesses on Sithelo are organised by South Africa&apos;s nine provinces and their
            municipalities, so you can search at the level of granularity procurement and enterprise
            development programmes actually need.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
