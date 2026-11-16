import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SitheloButton } from "@/components/ui/sithelo";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";

export const metadata: Metadata = {
  title: "Sithelo | Where South African businesses meet opportunity",
  description:
    "Sithelo connects South African entrepreneurs with institutions, procurement, funding and enterprise development opportunities through the Business Passport.",
  alternates: { canonical: "/" },
};

// No stats band or partner logos: none are backed by real figures or
// signed-off relationships yet (see AUDIT.md). Add them only once they are.
//
// Photography is self-hosted (public/images) under the Unsplash License.
// Captions state where each photo was actually taken rather than implying
// it shows a Sithelo business.

const NETWORK = [
  { label: "Entrepreneurs", body: "Build one Business Passport and use it for every opportunity that follows." },
  { label: "Established businesses", body: "Turn a track record into a credential institutions can act on." },
  { label: "Institutions", body: "Search and shortlist businesses whose documents have been reviewed, not just typed into a form." },
  { label: "Opportunity providers", body: "Reach capacity-ready businesses across every province, sector and municipality." },
];

const OPPORTUNITIES = [
  { title: "Procurement", body: "Supplier and contractor opportunities from municipalities and corporates." },
  { title: "Funding", body: "Grants, loans and blended finance matched to your stage." },
  { title: "Enterprise development", body: "Programmes that build capability, not just paperwork." },
  { title: "Partnerships", body: "Larger businesses looking for capable local partners." },
];

const WHY = [
  { n: "01", title: "Visibility", body: "Good businesses shouldn't be invisible. Your Business Passport puts yours in front of the organisations looking for it." },
  { n: "02", title: "Trust", body: "Your trust score comes from reviewed documents and your track record. Nobody types it in by hand." },
  { n: "03", title: "Access", body: "CIPC, SARS, VAT, B-BBEE, CIDB and Municipal Supplier Database documents, across all nine provinces." },
  { n: "04", title: "Opportunity", body: "Procurement, funding, enterprise development and partnerships, matched to what your business can actually deliver." },
];

export default function LandingPage() {
  return (
    <main id="main-content" className="bg-ivory">
      <SiteNav />

      {/* ================= HERO ================= */}
      <section className="container-editorial pt-6 md:pt-10 pb-20 md:pb-28">
        <div className="grid lg:grid-cols-[1fr_minmax(0,520px)] gap-12 lg:gap-16 items-center">
          <div>
            <div className="eyebrow mb-6">The Sithelo Business Passport</div>
            <h1 className="text-hero font-display font-medium text-navy max-w-[13ch]">
              Turning effort into opportunity.
            </h1>
            <p className="text-lg text-ink-600 leading-relaxed max-w-lg mt-7">
              You&apos;ve done the work. Sithelo turns it into one verified record that funders,
              municipalities and corporates can trust, so you stop proving yourself from scratch
              for every tender, grant and programme.
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-10">
              <SitheloButton href="/register?role=entrepreneur">Create your Business Passport</SitheloButton>
              <Link href="/for-institutions" className="btn-text">I represent an institution →</Link>
            </div>
            <p className="text-sm text-ink-500 mt-12 max-w-md">
              Free for entrepreneurs. No CIPC registration needed to start.
            </p>
          </div>

          <figure>
            <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-navy-900">
              <Image
                src="/images/shop-owner.jpg"
                alt="A shop owner standing behind the counter of her well-stocked general store"
                fill
                priority
                sizes="(min-width: 1024px) 520px, 100vw"
                className="object-cover object-[50%_40%]"
              />
            </div>
            <figcaption className="text-xs text-ink-500 mt-3">
              A shop owner in Dar es Salaam. Photo: Ali Mkumbwa / Unsplash
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ================= THE PROBLEM ================= */}
      <section className="rule">
        <div className="container-editorial section max-w-4xl">
          <div className="eyebrow mb-6">The Problem</div>
          <p className="text-display-lg font-display font-medium text-navy leading-tight">
            Good businesses are often invisible to opportunity.
            <span className="text-ink-600"> Not because they lack capability, but because they have no easy way to prove it.</span>
          </p>
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
              A credential worth handing over.
            </h2>
            <p className="text-white/65 leading-relaxed max-w-md mb-8">
              Identity, compliance documents, capability and track record, built once and kept
              current. Sithelo reviews what you upload, and your Passport becomes visible to
              institutions as soon as one of your documents is verified.
            </p>
            <SitheloButton variant="on-dark" href="/register?role=entrepreneur">Build your Passport</SitheloButton>
          </div>

          <div className="border border-white/15 rounded-card p-8 md:p-10 bg-white/[0.03]">
            <div className="flex items-baseline justify-between gap-6 mb-8 border-b border-white/10 pb-6">
              <div>
                <div className="eyebrow-on-dark mb-2">Example Business Passport</div>
                <div className="text-2xl font-display font-medium text-white">Karabo Manufacturing (Pty) Ltd</div>
                <div className="text-sm text-white/50 mt-1">Ekurhuleni, Gauteng</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-5xl font-display font-semibold text-white">87</div>
                <div className="text-eyebrow uppercase text-white/50 mt-1">Trust Score</div>
              </div>
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {[
                ["CIPC", "Verified"],
                ["SARS & VAT", "Verified"],
                ["B-BBEE", "Level 2"],
                ["CIDB", "Grade 6 CE"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/10 pb-3">
                  <dt className="text-white/55">{k}</dt>
                  <dd className="text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-white/40 mt-6">Illustrative example, not a real Sithelo business.</p>
          </div>
        </div>
      </section>

      {/* ================= OPPORTUNITIES ================= */}
      <section>
        <div className="container-editorial section">
          <div className="eyebrow mb-6">Opportunities</div>
          <h2 className="text-display-lg font-display font-medium text-navy leading-tight mb-14 max-w-2xl">
            Matched to what your business can actually deliver.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 rule border-t">
            {OPPORTUNITIES.map((item, i) => (
              <div
                key={item.title}
                className={`py-8 lg:pr-8 ${i > 0 ? "lg:border-l lg:pl-8" : ""} ${i % 2 === 1 ? "sm:border-l sm:pl-8 lg:pl-8" : ""} border-line ${i > 0 ? "border-t sm:border-t-0" : ""} ${i > 1 ? "sm:border-t lg:border-t-0" : ""}`}
              >
                <div className="text-eyebrow text-ink-500 mb-3">0{i + 1}</div>
                <h3 className="font-display font-semibold text-navy text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-ink-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE BUSINESSES ================= */}
      <section className="rule">
        <div className="container-editorial section">
          <div className="eyebrow mb-6">Who it&apos;s for</div>
          <h2 className="text-display-lg font-display font-medium text-navy leading-tight max-w-2xl mb-14">
            From a one-person workshop to a contractor ready for its next tender.
          </h2>

          <div className="grid md:grid-cols-2 gap-x-8 gap-y-12">
            <figure>
              <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-navy-900">
                <Image
                  src="/images/carpenter.jpg"
                  alt="A carpenter in his workshop, smiling at good news on his phone"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-5">
                <div className="eyebrow mb-2">Emerging</div>
                <p className="font-display text-xl font-medium text-navy">Your first contract shouldn&apos;t depend on who you know.</p>
                <p className="text-xs text-ink-500 mt-3">A carpenter in Dar es Salaam. Photo: Ali Mkumbwa / Unsplash</p>
              </figcaption>
            </figure>
            <figure>
              <div className="relative aspect-[3/2] overflow-hidden rounded-card bg-navy-900">
                <Image
                  src="/images/engineer.jpg"
                  alt="An electrical contractor in a hard hat standing beside a distribution board"
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover object-[30%_50%]"
                />
              </div>
              <figcaption className="mt-5">
                <div className="eyebrow mb-2">Established</div>
                <p className="font-display text-xl font-medium text-navy">Years of good work, in a form a procurement officer can check.</p>
                <p className="text-xs text-ink-500 mt-3">Photo: Unsplash</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ================= WHY SITHELO ================= */}
      <section className="rule bg-white">
        <div className="container-editorial section">
          <div className="eyebrow mb-10">Why Sithelo</div>
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
      <section className="bg-navy">
        <div className="container-editorial py-24 md:py-28 grid md:grid-cols-[1fr_auto] gap-10 items-end">
          <h2 className="text-display-lg font-display font-medium text-white leading-tight max-w-2xl">
            Your next opportunity starts with being ready for it.
          </h2>
          <div className="flex flex-wrap gap-3">
            <SitheloButton variant="on-dark" href="/register?role=entrepreneur">Create your Business Passport</SitheloButton>
            <SitheloButton variant="on-dark-ghost" href="/register?role=institution">Join as an institution</SitheloButton>
          </div>
        </div>
      </section>

      <div className="border-t border-white/10">
        <SiteFooter />
      </div>
    </main>
  );
}
