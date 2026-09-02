import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { SitheloButton } from "@/components/ui/sithelo";

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
    <main>
      <SiteNav />
      <section className="max-w-[1280px] mx-auto px-8 pt-6 pb-16">
        <div className="text-xs font-semibold tracking-wider uppercase text-teal mb-4">For Entrepreneurs</div>
        <h1 className="text-4xl font-display font-bold tracking-tight text-navy mb-5 max-w-2xl">
          Build your credibility once. Use it everywhere.
        </h1>
        <p className="text-base text-ink-600 leading-relaxed max-w-xl mb-8">
          The Business Passport is a single, verified record of who your business is and what it can
          do, so you stop re-proving yourself for every funder, tender or partner.
        </p>
        <SitheloButton href="/register?role=entrepreneur">Create your Passport</SitheloButton>
      </section>

      <section className="bg-ivory py-16">
        <div className="max-w-[1280px] mx-auto px-8">
          <h2 className="text-2xl font-display font-bold text-navy mb-8">Verification types your Passport covers</h2>
          <div className="flex flex-wrap gap-3">
            {VERIFICATIONS.map((v) => (
              <span key={v} className="badge-info text-sm px-4 py-2">{v}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-8 py-16">
        <h2 className="text-2xl font-display font-bold text-navy mb-10">How it works</h2>
        <div className="grid md:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card">
              <div className="text-xs font-semibold text-teal mb-3">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="text-[15px] font-display font-semibold text-navy mb-2">{s.title}</h3>
              <p className="text-[13px] text-ink-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-8 pb-20">
        <div className="surface-navy p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-display font-bold mb-3">What Sithelo won&apos;t do</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Sithelo doesn&apos;t rank your household or personal wealth, and it never gates
              opportunity eligibility on anything beyond your business&apos;s actual verification and
              track record. Your everyday context shapes how recommendations are framed for you;
              it&apos;s never shown to institutions.
            </p>
          </div>
          <div>
            <SitheloButton href="/register?role=entrepreneur" variant="dark">Get started</SitheloButton>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
