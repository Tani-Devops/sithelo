import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { PassportCredential } from "@/components/marketing/PassportCredential";

export const metadata: Metadata = {
  title: "For Entrepreneurs | Sithelo",
  description:
    "Build a verified Business Passport once and use it everywhere you seek funding, procurement, enterprise development and partnerships.",
  alternates: { canonical: "/for-entrepreneurs" },
};

const VERIFICATIONS = ["CIPC", "SARS", "VAT", "Banking", "B-BBEE", "Insurance", "CIDB", "Municipal supplier"];

const STEPS = [
  { title: "Create your Business Passport", body: "Register and set up your profile. No formal registration is required to start." },
  { title: "Add verifications and documents", body: "Work through CIPC, SARS, VAT, B-BBEE, CIDB and more at your own pace." },
  { title: "Your record builds itself", body: "As each document is confirmed, your Passport updates. Nothing is hand-set." },
  { title: "Apply to opportunities", body: "Use one verified Passport across funding, procurement and enterprise development." },
];

export default function ForEntrepreneursPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content" className="bg-linen text-midnight">
        {/* ================= HERO ================= */}
        <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden">
          <div className="lg:grid lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] lg:min-h-[clamp(620px,calc(100svh-84px),760px)]">
            <div className="flex flex-col justify-center px-5 sm:px-8 lg:pr-10 lg:pl-[max(2rem,calc((100vw-1240px)/2+2rem))] pt-12 pb-10 lg:py-16">
              <h1 id="hero-heading" className="font-display font-medium text-m-hero text-midnight max-w-[12ch] [overflow-wrap:break-word] min-w-0">
                Build your credibility once.
              </h1>
              <p className="m-lead mt-6 max-w-[32rem]">
                One verified record, so you stop re-proving yourself for every tender.
              </p>
              <div className="mt-9">
                <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto whitespace-nowrap !min-h-[52px] !px-7 !text-base">
                  Create your free Passport
                </Link>
              </div>
              <p className="text-[0.9375rem] text-ink-600 mt-8 flex items-center gap-3">
                <span className="m-rule shrink-0" aria-hidden="true" />
                No CIPC registration needed to start.
              </p>
            </div>
            <div className="relative">
              <figure className="relative h-[300px] sm:h-[400px] lg:absolute lg:inset-0 lg:h-auto">
                <div className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_70%,transparent)] lg:[mask-image:linear-gradient(to_right,transparent,black_26%)]">
                  <Image
                    src="/images/jhb-rosebank-crafts.jpg"
                    alt="Handmade bags, fabrics and hats with South African prints on a market table"
                    fill
                    priority
                    sizes="(min-width: 1024px) 54vw, 100vw"
                    className="object-cover object-[40%_50%] m-hero-settle"
                  />
                </div>
              </figure>
            </div>
          </div>
        </section>

        {/* ================= WHAT IT COVERS ================= */}
        <section aria-labelledby="covers-heading" className="bg-midnight text-paper">
          <div className="m-container m-section grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-14 lg:gap-24 items-center">
            <div>
              <h2 id="covers-heading" className="font-display font-medium text-m-section max-w-[14ch]">
                Every check, in one place.
              </h2>
              <ul className="mt-10 grid grid-cols-2 gap-x-8 gap-y-4 font-display text-m-title text-paper/90" aria-label="Verification types your Passport covers">
                {VERIFICATIONS.map((v) => <li key={v} className="border-t border-paper/15 pt-3">{v}</li>)}
              </ul>
            </div>
            <div className="max-w-[420px] w-full mx-auto lg:mx-0 lg:justify-self-end">
              <PassportCredential />
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section aria-labelledby="how-heading" className="bg-linen">
          <div className="m-container m-section grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12 lg:gap-24">
            <div className="lg:sticky lg:top-32 self-start">
              <h2 id="how-heading" className="m-heading max-w-[12ch]">How it works.</h2>
              <div className="mt-8">
                <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto whitespace-nowrap">Start your Passport</Link>
              </div>
            </div>
            <ol className="border-t border-midnight/15">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 py-8 border-b border-midnight/15">
                  <span className="font-display text-[2rem] leading-none text-copper-ink tabular-nums" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="font-display text-m-title text-midnight">
                      <span className="sr-only">Step {i + 1}: </span>{s.title}
                    </h3>
                    <p className="text-[1.0625rem] text-ink-700 mt-2 leading-relaxed max-w-lg">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ================= WHAT SITHELO WON'T DO ================= */}
        <section aria-labelledby="wont-heading" className="bg-linen-deep">
          <div className="m-container m-section">
            <h2 id="wont-heading" className="m-heading max-w-[22ch]">What Sithelo won&apos;t do.</h2>
            <p className="font-display text-[clamp(1.5rem,1.1rem+1.4vw,2.25rem)] text-midnight mt-10 max-w-[40ch] leading-snug">
              We never rank your household or personal wealth, and never gate an opportunity on anything
              beyond your business&apos;s verification and track record.
            </p>
            <p className="m-lead mt-6 max-w-xl">
              Your everyday context shapes how recommendations are framed for you. It is never shown to institutions.
            </p>
          </div>
        </section>

        {/* ================= CLOSE ================= */}
        <section aria-labelledby="final-heading" className="bg-midnight text-paper">
          <div className="m-container py-20 md:py-28 grid md:grid-cols-[minmax(0,1fr)_auto] gap-8 md:gap-16 items-end">
            <div>
              <h2 id="final-heading" className="font-display font-medium text-m-section max-w-[16ch]">
                Start with what you have.
              </h2>
              <p className="text-m-lead text-paper/80 mt-5 max-w-xl">It&apos;s free, and your Passport grows with your business.</p>
            </div>
            <Link href="/register?role=entrepreneur" className="m-btn-on-dark w-full md:w-auto whitespace-nowrap !min-h-[52px] !px-7 !text-base">
              Create your free Passport
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
