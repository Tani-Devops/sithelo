import Image from "next/image";
import type { Metadata } from "next";
import { SitheloButton } from "@/components/ui/sithelo";
import { SiteFooter } from "@/components/ui/MarketingChrome";
import { Hero } from "@/components/marketing/Hero";

export const metadata: Metadata = {
  title: "Sithelo | Where South African businesses meet opportunity",
  description:
    "Sithelo connects verified South African entrepreneurs with institutions, procurement, funding and enterprise development opportunities through the Business Passport.",
  alternates: { canonical: "/" },
};

// NOTE: the stats band and "trusted by" institutional logos previously here
// (50K+ businesses, R2.8B+ opportunities matched, Seda/IDC/DBSA/sefa/
// National Treasury/SALGA) stay removed — see AUDIT.md. None were backed
// by real, verified figures or confirmed institutional relationships.
// Re-add only once real numbers and signed-off partner logos exist.

const NETWORK = [
  { label: "Entrepreneurs", body: "Build a verified profile once. Apply it to every opportunity that follows." },
  { label: "Established businesses", body: "Turn a track record into a credential institutions can act on immediately." },
  { label: "Institutions", body: "Search and shortlist against real, verified compliance data — not self-reported claims." },
  { label: "Opportunity providers", body: "Reach capacity-ready businesses across every province, sector and municipality." },
];

const WHY = [
  { n: "01", title: "Visibility", body: "Good businesses shouldn't be invisible. A Business Passport puts yours in front of the organisations looking for it." },
  { n: "02", title: "Trust", body: "Your trust score is calculated from verification and track record, not typed in by hand." },
  { n: "03", title: "Access", body: "CIPC, SARS, VAT, B-BBEE, CIDB and Municipal Supplier Database verification, mapped to all nine provinces." },
  { n: "04", title: "Opportunity", body: "Procurement, funding, enterprise development and partnerships — matched to what your business can actually deliver." },
];

export default function LandingPage() {
  return (
    <main id="main-content" className="bg-ivory">
      {/* ================= HERO ================= */}
      <Hero />

      {/* ================= THE PROBLEM ================= */}
      <section className="section">
        <div className="container-editorial max-w-3xl">
          <div className="eyebrow mb-6">The Problem</div>
          <h2 className="text-display-lg font-display font-medium text-navy leading-tight">
            Good businesses are often invisible to opportunity —
            <span className="text-ink-600"> not because they lack capability, but because they lack a way to prove it.</span>
          </h2>
        </div>
      </section>

      {/* ================= THE NETWORK ================= */}
      <section className="rule">
        <div className="container-editorial section">
          <div className="grid md:grid-cols-[minmax(0,340px)_1fr] gap-14 md:gap-20">
            <div>
              <div className="eyebrow mb-6">The Sithelo Network</div>
              <h2 className="text-display-lg font-display font-medium text-navy leading-tight">
                Built for both sides of the opportunity.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-10">
              {NETWORK.map((item) => (
                <div key={item.label} className="border-t border-line pt-5">
                  <h3 className="text-base font-display font-semibold text-navy mb-2">{item.label}</h3>
                  <p className="text-sm text-ink-600 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= BUSINESS PASSPORT ================= */}
      <section className="bg-navy-900 text-white overflow-hidden">
        <div className="container-editorial section grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="eyebrow-on-dark mb-6">The Business Passport</div>
            <h2 className="text-display-lg font-display font-medium text-white leading-tight mb-6">
              A digital credential worth sharing.
            </h2>
            <p className="text-white/65 leading-relaxed max-w-md mb-8">
              Identity, verification, compliance, capability and track record — built once, in one
              place. Not another dashboard tile. A credential your business is proud to hand over.
            </p>
            <SitheloButton variant="on-dark" href="/register?role=entrepreneur">Build Your Passport</SitheloButton>
          </div>

          {/* Passport artefact — deliberately not a generic dashboard card */}
          <div className="relative">
            <div className="border border-white/15 rounded-card p-8 md:p-10 bg-white/[0.03] backdrop-blur-sm">
              <div className="flex items-baseline justify-between mb-8 border-b border-white/10 pb-6">
                <div>
                  <div className="eyebrow-on-dark mb-2">Example Business Passport™</div>
                  <div className="text-2xl font-display font-medium text-white">Karabo Manufacturing (Pty) Ltd</div>
                  <div className="text-sm text-white/50 mt-1">Ekurhuleni, Gauteng</div>
                </div>
                <div className="text-right shrink-0 pl-6">
                  <div className="text-5xl font-display font-semibold text-white">87</div>
                  <div className="text-eyebrow uppercase text-white/50 mt-1">Trust Score</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-white/55">CIPC</span><span className="text-white">Verified</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-white/55">SARS &amp; VAT</span><span className="text-white">Verified</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-white/55">B-BBEE</span><span className="text-white">Level 2</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-white/55">CIDB</span><span className="text-white">Grade 6 CE</span>
                </div>
              </div>
              <p className="text-xs text-white/40 mt-6">Illustrative example. Not an actual Sithelo business or live data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= OPPORTUNITIES ================= */}
      <section className="rule relative overflow-hidden">
        {/* Stylized South Africa silhouette, decorative only (aria-hidden) —
            fills the dead space to the right of the heading without
            competing with it: very low opacity, bleeds off the right edge,
            no borders/labels. Not a to-scale map, just a recognizable mark. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 500 520"
          className="pointer-events-none absolute -right-16 top-1/2 -translate-y-1/2 h-[140%] w-auto text-navy/[0.05] hidden md:block"
        >
          <path
            fillRule="evenodd"
            fill="currentColor"
            d="M130 40 C200 20 300 15 370 40 C410 55 430 90 440 130 C448 165 420 175 395 190
               C430 210 460 250 455 300 C450 350 415 390 390 430 C360 470 320 495 270 505
               C220 500 180 480 150 450 C110 415 90 370 80 320 C70 270 75 220 90 175
               C100 140 95 100 110 70 C118 55 122 47 130 40 Z
               M300 338 C288 324 272 328 265 345 C259 361 268 380 287 384
               C305 388 321 373 319 355 C318 345 310 340 300 338 Z"
          />
        </svg>
        <div className="container-editorial section relative">
          <div className="eyebrow mb-6">Opportunities</div>
          <h2 className="text-display-lg font-display font-medium text-navy leading-tight mb-14 max-w-xl">
            Procurement, funding, partnerships and growth — matched to your business.
          </h2>
          <div className="grid md:grid-cols-4">
            {["Procurement", "Funding", "Partnerships", "Growth"].map((title, i) => (
              <div key={title} className={`py-8 pr-8 ${i > 0 ? "md:border-l border-line md:pl-8" : ""} ${i > 0 ? "border-t md:border-t-0 border-line" : ""}`}>
                <div className="text-eyebrow text-ink-500 mb-3">0{i + 1}</div>
                <h3 className="font-display font-semibold text-navy text-lg">{title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE BUSINESSES (photography-led) ================= */}
      <section className="section">
        <div className="container-editorial mb-14">
          <div className="eyebrow mb-6">Meet the Businesses</div>
          <h2 className="text-display-lg font-display font-medium text-navy leading-tight max-w-xl">
            From the entrepreneur building her first company, to the business ready for its next contract.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-1">
          <div className="relative h-[420px] md:h-[520px]">
            <Image
              src="https://images.unsplash.com/photo-1692689383052-9fbf3d1c0969?auto=format&fit=crop&w=1400&q=80"
              alt="A weekend market in Johannesburg, South Africa"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(8,22,37,0.65) 0%, rgba(8,22,37,0) 45%)" }} />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="eyebrow-on-dark mb-2">Emerging</div>
              <p className="text-white font-display text-xl font-medium max-w-xs">Building visibility from the ground up.</p>
            </div>
          </div>
          <div className="relative h-[420px] md:h-[520px]">
            <Image
              src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1400&q=80"
              alt="Civil engineer at a construction site"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(8,22,37,0.65) 0%, rgba(8,22,37,0) 45%)" }} />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="eyebrow-on-dark mb-2">Established</div>
              <p className="text-white font-display text-xl font-medium max-w-xs">Ready for its next contract.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= WHY SITHELO ================= */}
      <section className="rule bg-white">
        <div className="container-editorial section">
          <div className="eyebrow mb-6">Why Sithelo</div>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
            {WHY.map((item) => (
              <div key={item.n} className="flex gap-6">
                <span className="text-eyebrow text-ink-500 pt-1.5">{item.n}</span>
                <div>
                  <h3 className="font-display font-semibold text-navy text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-ink-600 leading-relaxed max-w-sm">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-navy-900">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1744604030401-b24c5975a574?auto=format&fit=crop&w=2000&q=70"
            alt="South African skyline"
            fill
            sizes="100vw"
            className="object-cover opacity-25"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-fade-navy-t" />
        </div>
        <div className="relative container-editorial py-24 md:py-32 text-center">
          <h2 className="text-display-lg font-display font-medium text-white leading-tight max-w-2xl mx-auto mb-10">
            Your next opportunity starts with being ready for it.
          </h2>
          <SitheloButton variant="on-dark" href="/register?role=entrepreneur">Build Your Business Profile</SitheloButton>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
