import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { PassportCredential } from "@/components/marketing/PassportCredential";
import { SouthAfricaMap } from "@/components/marketing/SouthAfricaMap";
import { PassportStages } from "@/components/marketing/PassportStages";

export const metadata: Metadata = {
  title: "Sithelo | Turning effort into opportunity",
  description:
    "Build one trusted Business Passport that helps South African institutions understand what your business can deliver. Free to start, no CIPC registration needed.",
  alternates: { canonical: "/" },
};

// Content rules for this page (see docs/reports/SITHELO_2_UI_IMPLEMENTATION_REPORT.md):
// - No user counts, partner logos, testimonials or success stories: none
//   are backed by real data yet.
// - Every product claim matches what the app does today.
// - Photographs are South African only, each with its location confirmed
//   on its Unsplash page, self-hosted under the Unsplash License (which
//   does not require on-page credit; sources are listed in the UI report).
//   None are presented as Sithelo users.

const AUDIENCES = [
  ["Informal and new businesses", "Start with what you have. Your Passport grows as your business formalises."],
  ["Emerging entrepreneurs", "Turn the work you've already done into a record someone else can rely on."],
  ["Established SMEs", "Keep compliance documents in one place, with expiry dates you can see coming."],
  ["Contractors and suppliers", "Hold CIDB, municipal supplier and tax documents together, ready for the next tender."],
];

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content" className="bg-linen text-midnight">
        {/* ================= 01 HERO: the Business Passport ================= */}
        <section aria-labelledby="hero-heading" className="relative isolate bg-linen overflow-hidden">
          {/* South Africa, faintly, behind the headline. */}
          <SouthAfricaMap className="pointer-events-none absolute -z-10 text-midnight/[0.05] w-[560px] -left-24 top-24 sm:w-[720px] sm:-left-32 lg:w-[760px] lg:left-[max(-6rem,calc((100vw-1240px)/2-9rem))] lg:top-10" />

          <div className="lg:grid lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] lg:min-h-[clamp(680px,calc(100svh-84px),800px)]">
            <div className="flex flex-col justify-center px-5 sm:px-8 lg:pr-10 lg:pl-[max(2rem,calc((100vw-1240px)/2+2rem))] pt-12 pb-10 sm:pt-16 lg:py-20">
              <h1 id="hero-heading" className="font-display font-medium text-m-hero text-midnight max-w-[12ch] [text-wrap:balance]">
                Turning effort into opportunity.
              </h1>
              <p className="m-lead mt-6 max-w-[34rem]">
                One trusted profile that shows institutions what you can deliver.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row sm:items-center lg:flex-col lg:items-start 2xl:flex-row 2xl:items-center gap-3 sm:gap-4">
                <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto sm:whitespace-nowrap !min-h-[52px] !px-7 !text-base">
                  Create your free Passport
                </Link>
                <a href="#how-it-works" className="m-btn-glass w-full sm:w-auto whitespace-nowrap !min-h-[52px]">
                  See how it works
                </a>
              </div>
              <p className="text-[0.9375rem] text-ink-600 mt-8 flex items-center gap-3">
                <span className="m-rule shrink-0" aria-hidden="true" />
                No CIPC registration needed to start.
              </p>
            </div>

            {/* The Passport is the hero object: it floats across the seam
                between the linen and a Johannesburg construction site. */}
            <div className="relative">
              <figure className="relative h-[300px] sm:h-[400px] lg:absolute lg:inset-0 lg:h-auto">
                <div className="absolute inset-0 overflow-hidden
                                [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_70%,transparent)]
                                lg:[mask-image:linear-gradient(to_right,transparent,black_26%)]">
                  <Image
                    src="/images/jhb-construction.jpg"
                    alt="A site team and two reviewers in hard hats on a building reconstruction in Parktown, Johannesburg"
                    fill
                    priority
                    sizes="(min-width: 1024px) 54vw, 100vw"
                    className="object-cover object-[60%_40%] lg:object-[0%_40%] m-hero-settle"
                  />
                  <div className="absolute inset-0 bg-midnight/10" aria-hidden="true" />
                </div>
              </figure>

              <div className="relative z-10 -mt-36 sm:-mt-48 px-5 pb-14 sm:px-8 lg:absolute lg:inset-y-0 lg:left-0 lg:mt-0 lg:pb-0 lg:px-0 lg:flex lg:items-center lg:pl-[3%]">
                <div className="m-float mx-auto w-full max-w-[420px] lg:mx-0 lg:w-[340px] xl:w-[370px] 2xl:w-[400px]">
                  <PassportCredential compactOnDesktop />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 02 THE PROBLEM ================= */}
        <section aria-labelledby="problem-heading" className="bg-midnight text-paper">
          <div className="m-container m-section">
            <div className="max-w-4xl m-reveal">
              <h2 id="problem-heading" className="font-display font-medium text-m-section">
                Good businesses deserve to be seen.
              </h2>
              <p className="text-m-lead text-paper/80 mt-6 max-w-2xl [text-wrap:pretty]">
                Capable businesses miss work they could deliver because their track record lives in a
                drawer, a phone and certificates nobody else can check.
              </p>
            </div>
            <dl className="grid sm:grid-cols-3 gap-x-10 gap-y-8 mt-14 m-reveal">
              {[
                ["The work is real.", "Years of jobs done, customers served and staff paid."],
                ["The proof is scattered.", "Certificates, letters and statements in different places, often out of date."],
                ["The opportunity goes elsewhere.", "Institutions choose the businesses they can verify quickly."],
              ].map(([t, d]) => (
                <div key={t} className="border-t border-copper/60 pt-5">
                  <dt className="font-display text-m-title">{t}</dt>
                  <dd className="text-[1rem] text-paper/75 mt-2 leading-relaxed">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ================= 03 HOW IT WORKS: the Passport filling in ================= */}
        <section id="how-it-works" aria-labelledby="how-heading" className="bg-linen scroll-mt-24">
          <div className="m-container m-section">
            <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 lg:gap-16 items-end m-reveal">
              <h2 id="how-heading" className="m-heading max-w-[16ch]">From first sign-up to being seen.</h2>
              <p className="m-lead max-w-md">
                Your Passport holds who you are, what you can do and the documents that prove it.
              </p>
            </div>
            <div className="mt-14 m-reveal">
              <PassportStages />
            </div>
            <div className="mt-12">
              <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto sm:whitespace-nowrap">Start your Passport</Link>
            </div>
          </div>
        </section>

        {/* ================= 04 WHO IT'S FOR ================= */}
        <section aria-labelledby="entrepreneurs-heading" className="bg-linen-deep overflow-hidden">
          <div className="lg:grid lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
            <figure className="relative min-h-[320px] sm:min-h-[420px] lg:min-h-[680px]">
              <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_80%,transparent)] lg:[mask-image:linear-gradient(to_left,transparent,black_22%)]">
                <Image
                  src="/images/jhb-rosebank-crafts.jpg"
                  alt="Handmade bags, fabrics and hats with South African prints on a market table"
                  fill
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover object-[35%_50%]"
                />
              </div>
            </figure>
            <div className="px-5 sm:px-8 lg:pl-14 lg:pr-[max(2rem,calc((100vw-1240px)/2+2rem))] pt-10 pb-20 md:pb-28 lg:py-28 flex flex-col justify-center m-reveal">
              <h2 id="entrepreneurs-heading" className="m-heading max-w-[16ch]">
                Every business has a story worth proving.
              </h2>
              <p className="m-lead mt-6 max-w-xl">
                A spaza shop and a civil contractor need different documents. Your Passport holds what
                fits yours.
              </p>
              <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-7 mt-10">
                {AUDIENCES.map(([t, d]) => (
                  <div key={t} className="border-t border-midnight/15 pt-4">
                    <dt className="font-semibold text-midnight text-[1.0625rem]">{t}</dt>
                    <dd className="text-[1rem] text-ink-700 mt-1.5 leading-relaxed">{d}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10">
                <Link href="/for-entrepreneurs" className="m-link">How it works for entrepreneurs</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 05 INSTITUTIONS: one clear door ================= */}
        <section aria-labelledby="institutions-heading" className="bg-linen">
          <div className="m-container py-16 md:py-20 grid md:grid-cols-[minmax(0,1fr)_auto] gap-6 md:gap-16 items-center">
            <div>
              <h2 id="institutions-heading" className="font-display font-medium text-m-title text-midnight">
                Funding, procuring or running enterprise development?
              </h2>
              <p className="text-[1.0625rem] text-ink-700 mt-2">Find businesses you can verify, not just discover.</p>
            </div>
            <Link href="/for-institutions" className="m-btn-glass w-full md:w-auto whitespace-nowrap">Sithelo for institutions</Link>
          </div>
        </section>

        {/* ================= 07 FINAL CONVERSION ================= */}
        <section aria-labelledby="final-heading" className="relative bg-midnight text-paper overflow-hidden">
          <figure className="relative h-[280px] sm:h-[380px] lg:h-[480px]">
            <Image
              src="/images/cape-town.jpg"
              alt="Cape Town from the air: Table Mountain, Lion's Head and the city above the Atlantic"
              fill
              sizes="100vw"
              className="object-cover object-[50%_45%]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-linen/0 via-midnight/25 to-midnight" aria-hidden="true" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-linen to-transparent" aria-hidden="true" />
          </figure>
          <div className="m-container relative -mt-24 sm:-mt-28 pb-20 md:pb-28 grid md:grid-cols-[1fr_auto] gap-8 md:gap-16 items-end">
            <div>
              <h2 id="final-heading" className="font-display font-medium text-m-section max-w-[18ch]">
                Your next opportunity starts with being ready for it.
              </h2>
              <p className="text-m-lead text-paper/80 mt-5 max-w-xl">
                Build your Business Passport today. It&apos;s free, and you can start with what you have.
              </p>
            </div>
            <Link href="/register?role=entrepreneur" className="m-btn-on-dark w-full md:w-auto !min-h-[52px] !px-7 !text-base">
              Create your free Passport
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
