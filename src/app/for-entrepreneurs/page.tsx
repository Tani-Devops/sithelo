import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { SitheloButton, HeroPhoto } from "@/components/ui/sithelo";

export const metadata: Metadata = {
  title: "For Entrepreneurs | Sithelo",
  description:
    "Build a verified Business Passport once and use it everywhere you seek funding, procurement, enterprise development and partnerships.",
  alternates: { canonical: "/for-entrepreneurs" },
};

const VERIFICATIONS = ["CIPC", "SARS", "VAT", "Banking", "B-BBEE", "Insurance", "CIDB", "Municipal Supplier"];

const STEPS = [
  { title: "Create your Business Passport", body: "Register and set up your business profile: no formal registration required to get started." },
  { title: "Add verifications and documents", body: "Work through CIPC, SARS, VAT, B-BBEE, CIDB and other verification types at your own pace." },
  { title: "Your trust score builds automatically", body: "As verifications and documents are confirmed, your trust score is calculated automatically, never hand-set." },
  { title: "Apply to opportunities", body: "Use one verified Passport across funding, procurement and enterprise development opportunities." },
];

export default function ForEntrepreneursPage() {
  return (
    <main id="main-content">
      <SiteNav />
      <section className="container-editorial pt-6 pb-16 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <div className="eyebrow mb-4">For Entrepreneurs</div>
          <h1 className="text-display-lg font-display font-medium text-navy leading-tight mb-5">
            Build your credibility once. Use it everywhere.
          </h1>
          <p className="text-base text-ink-600 leading-relaxed max-w-xl mb-8">
            The Business Passport is a single, verified record of who your business is and what it can
            do, so you stop re-proving yourself for every funder, tender or partner.
          </p>
          <SitheloButton href="/register?role=entrepreneur">Create your Passport</SitheloButton>
        </div>
        <HeroPhoto
          src="https://images.unsplash.com/photo-1531483245484-5ca8c23a880b?auto=format&fit=crop&w=1200&q=80"
          alt="Entrepreneurs collaborating"
        />
      </section>

      <section className="bg-ivory py-16">
        <div className="container-editorial">
          <h2 className="text-2xl font-display font-medium text-navy mb-8">Verification types your Passport covers</h2>
          <div className="flex flex-wrap gap-3">
            {VERIFICATIONS.map((v) => (
              <span key={v} className="badge-info text-sm px-4 py-2">{v}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-editorial py-16">
        <h2 className="text-2xl font-display font-medium text-navy mb-10">How it works</h2>
        <div className="rule border-t">
          {STEPS.map((s, i) => (
            <div key={s.title} className="grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-2 py-7 border-b border-line">
              <div className="text-eyebrow text-ink-500">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <h3 className="text-base font-display font-medium text-navy mb-1.5">{s.title}</h3>
                <p className="text-sm text-ink-600 leading-relaxed max-w-md">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-editorial pb-20">
        <div className="surface-navy p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-display font-medium mb-3">What Sithelo won&apos;t do</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Sithelo doesn&apos;t rank your household or personal wealth, and it never gates
              opportunity eligibility on anything beyond your business&apos;s actual verification and
              track record. Your everyday context shapes how recommendations are framed for you;
              it&apos;s never shown to institutions.
            </p>
          </div>
          <div>
            <SitheloButton href="/register?role=entrepreneur" variant="on-dark">Create your business profile</SitheloButton>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
