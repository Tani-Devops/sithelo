import Image from "next/image";
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
    <main id="main-content">
      <SiteNav />
      <section className="container-editorial pt-6 pb-16 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <div className="eyebrow mb-4">For Institutions</div>
          <h1 className="text-display-lg font-display font-medium text-navy leading-tight mb-5">
            Find capacity-ready businesses you can trust.
          </h1>
          <p className="text-base text-ink-600 leading-relaxed max-w-xl mb-8">
            Sithelo gives funders, enterprise development programmes, procurement teams and corporate
            partners a faster path to verified, ready-to-work South African businesses.
          </p>
          <SitheloButton href="/register?role=institution">Register your institution</SitheloButton>
        </div>
        <div className="relative h-[340px] md:h-[420px] rounded-card overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80"
            alt="Civil engineer at a construction site"
            fill
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="container-editorial py-16">
        <div className="rule border-t">
          {CAPABILITIES.map((c, i) => (
            <div key={c.title} className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-2 py-7 border-b border-line">
              <div className="text-eyebrow text-ink-500">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <h3 className="text-base font-display font-medium text-navy mb-1.5">{c.title}</h3>
                <p className="text-sm text-ink-600 leading-relaxed max-w-md">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ivory py-16">
        <div className="container-editorial">
          <h2 className="text-2xl font-display font-medium text-navy mb-3">Nationwide coverage</h2>
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
