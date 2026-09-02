import Image from "next/image";
import type { Metadata } from "next";
import { SitheloButton } from "@/components/ui/sithelo";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";

export const metadata: Metadata = {
  title: "Sithelo | Helping entrepreneurs turn effort into results",
  description:
    "Sithelo connects verified South African entrepreneurs with institutions, procurement, funding and enterprise development opportunities through the Business Passport.",
  alternates: { canonical: "/" },
};

// NOTE: The stats band and "trusted by" institutional logos that previously
// lived here (50K+ businesses, R2.8B+ opportunities matched, Seda/IDC/DBSA/
// sefa/National Treasury/SALGA) have been removed. None of these were backed
// by real, verified figures or confirmed institutional relationships in this
// repository — see the audit report for details. Re-add only once real,
// verifiable numbers and signed-off partner logos exist.

const FEATURES = [
  { title: "One verified Business Passport", body: "Build it once: CIPC, SARS, VAT, B-BBEE, CIDB and more, all in one credential." },
  { title: "Trust score, not self-reported claims", body: "Your trust score is calculated from actual verification and track-record data, not entered by hand." },
  { title: "Built for South African business", body: "CIPC, SARS, VAT, B-BBEE, CIDB and Municipal Supplier Database verification, mapped to all nine provinces." },
  { title: "Institutions search with confidence", body: "Institutions discover and shortlist businesses against real, verified compliance data." },
];

export default function LandingPage() {
  return (
    <main>
      <SiteNav />

      <section className="max-w-[1280px] mx-auto px-8 pt-10 pb-4">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          <div>
            <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">
              Business Passport™ · Verified. Trusted. Ready.
            </div>
            <h1 className="text-[52px] leading-[1.05] font-display font-bold tracking-tight text-navy mb-5">
              Helping entrepreneurs turn effort into results.
            </h1>
            <p className="text-base text-ink-600 leading-relaxed max-w-md mb-8">
              Sithelo connects verified South African entrepreneurs with institutions, opportunities,
              funding, procurement and partnerships.
            </p>
            <div className="flex gap-3 mb-10">
              <SitheloButton href="/register?role=entrepreneur">I&apos;m an Entrepreneur</SitheloButton>
              <SitheloButton variant="ghost" href="/register?role=institution">I&apos;m an Institution</SitheloButton>
            </div>
          </div>
          <div className="relative h-[440px] rounded-card overflow-hidden shadow-glow">
            <Image
              src="https://images.unsplash.com/photo-1744604030401-b24c5975a574?auto=format&fit=crop&w=1400&q=80"
              alt="Table Mountain overlooking Cape Town"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,36,62,0) 40%, rgba(16,36,62,0.55) 100%)" }} />
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-8 py-20">
        <h2 className="text-3xl font-display font-bold tracking-tight text-navy mb-3">Built for both sides of the opportunity</h2>
        <p className="text-ink-600 text-[15px] max-w-lg mb-10">
          Entrepreneurs own a verified Business Passport. Institutions search, shortlist and contract with confidence.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-0 overflow-hidden">
            <div className="relative h-[220px]">
              <Image
                src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80"
                alt="Civil engineer at a construction site"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-6">
              <h3 className="text-lg font-display font-semibold text-navy mb-2">For Entrepreneurs</h3>
              <p className="text-sm text-ink-600 leading-relaxed mb-4">
                Build your Business Passport once, apply it everywhere: funding, procurement,
                enterprise development and partnerships.
              </p>
              <SitheloButton href="/for-entrepreneurs" variant="ghost">Learn more</SitheloButton>
            </div>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="relative h-[220px] surface-navy !rounded-none" />
            <div className="p-6">
              <h3 className="text-lg font-display font-semibold text-navy mb-2">For Institutions</h3>
              <p className="text-sm text-ink-600 leading-relaxed mb-4">
                Search compliant, capacity-ready businesses across sector, province and municipality,
                every profile backed by real verification.
              </p>
              <SitheloButton href="/for-institutions" variant="ghost">Learn more</SitheloButton>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ivory py-20">
        <div className="max-w-[1280px] mx-auto px-8">
          <h2 className="text-3xl font-display font-bold tracking-tight text-navy mb-3">Trust is the product</h2>
          <p className="text-ink-600 text-[15px] max-w-lg mb-10">
            Every verification, every completed opportunity, every reference strengthens the Business Passport.
          </p>
          <div className="grid md:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-cobalt" style={{ background: "rgba(103,199,242,0.14)" }}>
                  ✓
                </div>
                <h4 className="text-[15px] font-display font-semibold text-navy mb-2">{f.title}</h4>
                <p className="text-[13px] text-ink-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
