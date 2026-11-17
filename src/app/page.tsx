import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { PassportCredential } from "@/components/marketing/PassportCredential";
import { SouthAfricaMap } from "@/components/marketing/SouthAfricaMap";

export const metadata: Metadata = {
  title: "Sithelo | Turning effort into opportunity",
  description:
    "Build one trusted Business Passport that helps South African institutions understand what your business can deliver. Free to start, no CIPC registration needed.",
  alternates: { canonical: "/" },
};

// Content rules for this page (see SITHELO_2_UI_IMPLEMENTATION_REPORT.md):
// - No user counts, partner logos, testimonials or success stories: none
//   are backed by real data yet.
// - Every product claim matches what the app does today.
// - Photographs are South African only, each with its location confirmed
//   on its Unsplash page, self-hosted under the Unsplash License (which
//   does not require on-page credit; sources are listed in the UI report).
//   None are presented as Sithelo users.

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up as an entrepreneur. It's free and takes a couple of minutes.",
  },
  {
    title: "Tell us about your business",
    body: "A short, guided set of questions about what you do and where. Ranges are fine; no CIPC registration is needed to start.",
  },
  {
    title: "Upload your documents",
    body: "Add what you have: CIPC, tax, B-BBEE, CIDB and more. Sithelo reviews each one and records when it expires.",
  },
  {
    title: "Get seen, and apply",
    body: "Once a document is verified, your Passport becomes visible to institutions, and you can apply to opportunities with it.",
  },
];

const PASSPORT_PARTS = [
  ["Business identity", "Name, location, industry and what you offer."],
  ["Reviewed documents", "Each record marked verified, under review or due for renewal, with its expiry date."],
  ["Capabilities", "The services, equipment and capacity you bring."],
  ["Visibility", "Shown to institutions once your first document is verified."],
];

const AUDIENCES = [
  {
    title: "Informal and new businesses",
    body: "Start with what you have. Your Passport grows as your business formalises.",
  },
  {
    title: "Emerging entrepreneurs",
    body: "Turn the work you've already done into a record someone else can rely on.",
  },
  {
    title: "Established SMEs",
    body: "Keep compliance documents in one place, with expiry dates you can see coming.",
  },
  {
    title: "Contractors and suppliers",
    body: "Hold CIDB, municipal supplier and tax documents together, ready for the next tender.",
  },
];

const INSTITUTION_FEATURES = [
  "Search published businesses by industry, province and name.",
  "See which compliance records have been verified, not just claimed.",
  "Shortlist businesses and review the applications to your opportunities.",
  "Publish opportunities once Sithelo has approved your institution.",
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

          <div className="lg:grid lg:grid-cols-[minmax(0,50fr)_minmax(0,50fr)] lg:min-h-[clamp(680px,calc(100vh-84px),800px)]">
            <div className="flex flex-col justify-center px-5 sm:px-8 lg:pr-16 lg:pl-[max(2rem,calc((100vw-1240px)/2+2rem))] pt-12 pb-10 sm:pt-16 lg:py-20">
              <p className="m-eyebrow">The Sithelo Business Passport</p>
              <h1 id="hero-heading" className="font-display font-medium text-m-hero text-midnight mt-5 max-w-[12ch] [text-wrap:balance]">
                Turning effort into opportunity.
              </h1>
              <p className="m-lead mt-6 max-w-[34rem]">
                Your business deserves to be seen. Build one trusted profile that helps institutions
                understand what you can deliver.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center gap-3 sm:gap-4">
                <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto sm:whitespace-nowrap !min-h-[52px] !px-7 !text-base">
                  Create your free Business Passport
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
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover object-[60%_40%] m-hero-settle"
                  />
                  <div className="absolute inset-0 bg-midnight/10" aria-hidden="true" />
                </div>
              </figure>

              <div className="relative z-10 -mt-36 sm:-mt-48 px-5 pb-14 sm:px-8 lg:absolute lg:inset-y-0 lg:left-0 lg:mt-0 lg:pb-0 lg:px-0 lg:flex lg:items-center lg:pl-[4%]">
                <div className="m-float mx-auto w-full max-w-[420px] lg:w-[420px]">
                  <PassportCredential />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 02 THE PROBLEM ================= */}
        <section aria-labelledby="problem-heading" className="bg-midnight text-paper">
          <div className="m-container m-section">
            <div className="max-w-4xl m-reveal">
              <p className="m-eyebrow-on-dark">The problem</p>
              <h2 id="problem-heading" className="font-display font-medium text-m-section mt-5 [text-wrap:balance]">
                Good businesses deserve to be seen.
              </h2>
              <p className="text-m-lead text-paper/80 mt-6 max-w-2xl [text-wrap:pretty]">
                Across South Africa, capable businesses miss opportunities they could deliver, not for
                lack of skill, but because their track record lives in a drawer, a phone and a
                handful of certificates nobody else can easily check.
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
                  <dd className="text-[0.9375rem] text-paper/75 mt-2 leading-relaxed">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ================= 03 THE BUSINESS PASSPORT ================= */}
        <section aria-labelledby="passport-heading" className="relative isolate bg-linen overflow-hidden">
          <SouthAfricaMap className="pointer-events-none absolute -z-10 text-copper/[0.08] w-[620px] -right-40 -bottom-24 hidden md:block" />
          <div className="m-container m-section grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-12 lg:gap-24 items-start">
            <div className="m-reveal">
              <p className="m-eyebrow">The Business Passport</p>
              <h2 id="passport-heading" className="m-heading mt-5 max-w-[14ch]">One record. Ready when you are.</h2>
              <p className="m-lead mt-6 max-w-xl">
                Your Passport brings together who your business is, what it can do and the documents
                that prove it. Sithelo reviews what you upload, so institutions see what has been
                checked rather than taking your word for it.
              </p>
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-9 m-reveal lg:pt-3">
              {PASSPORT_PARTS.map(([t, d], i) => (
                <div key={t} className="border-t border-copper pt-5">
                  <dt className="flex items-baseline gap-3">
                    <span className="font-display text-lg text-copper-ink tabular-nums" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-m-title text-midnight">{t}</span>
                  </dt>
                  <dd className="text-[1.0625rem] text-ink-700 mt-2 leading-relaxed">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ================= 04 HOW IT WORKS ================= */}
        <section id="how-it-works" aria-labelledby="how-heading" className="bg-linen-deep scroll-mt-24">
          <div className="m-container m-section">
            <div className="max-w-2xl m-reveal">
              <p className="m-eyebrow">How it works</p>
              <h2 id="how-heading" className="m-heading mt-5">From first sign-up to being seen.</h2>
            </div>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-12 mt-14 m-reveal">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t border-copper pt-6">
                  <span className="font-display text-[2.5rem] leading-none text-copper-ink tabular-nums" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-m-title text-midnight mt-5">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="text-[1rem] text-ink-700 mt-3 leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-14">
              <Link href="/register?role=entrepreneur" className="m-btn-primary w-full sm:w-auto">Start your Business Passport</Link>
            </div>
          </div>
        </section>

        {/* ================= 05 FOR ENTREPRENEURS ================= */}
        <section aria-labelledby="entrepreneurs-heading" className="bg-linen overflow-hidden">
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
              <p className="m-eyebrow">For entrepreneurs</p>
              <h2 id="entrepreneurs-heading" className="m-heading mt-5 max-w-[16ch]">
                Every business has a story worth proving.
              </h2>
              <p className="m-lead mt-6 max-w-xl">
                A spaza shop and a civil contractor need different documents. Your Passport holds what
                is relevant to your business, and shows it in a form institutions can act on.
              </p>
              <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-7 mt-10">
                {AUDIENCES.map((a) => (
                  <div key={a.title} className="border-t border-midnight/15 pt-4">
                    <dt className="font-semibold text-midnight text-[1.0625rem]">{a.title}</dt>
                    <dd className="text-[1rem] text-ink-700 mt-1.5 leading-relaxed">{a.body}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10">
                <Link href="/for-entrepreneurs" className="m-btn-glass">How Sithelo works for entrepreneurs</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 06 FOR INSTITUTIONS ================= */}
        <section aria-labelledby="institutions-heading" className="bg-linen-deep">
          <div className="m-container m-section grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-12 lg:gap-24">
            <div className="m-reveal">
              <p className="m-eyebrow">For institutions</p>
              <h2 id="institutions-heading" className="m-heading mt-5 max-w-[14ch]">
                Find businesses you can verify, not just discover.
              </h2>
              <p className="m-lead mt-6 max-w-lg">
                Municipalities, funders, corporates and development agencies use Sithelo to find
                capable local businesses and see what has been checked before they engage.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Link href="/register?role=institution" className="m-btn-primary w-full sm:w-auto">Register your institution</Link>
                <Link href="/for-institutions" className="m-btn-glass w-full sm:w-auto">Learn more</Link>
              </div>
            </div>
            <ol className="m-reveal lg:pt-4">
              {INSTITUTION_FEATURES.map((f, i) => (
                <li key={f} className="grid grid-cols-[3rem_1fr] items-baseline border-t border-midnight/20 py-6 last:border-b">
                  <span className="font-display text-xl text-copper-ink tabular-nums" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-m-lead text-midnight">{f}</p>
                </li>
              ))}
            </ol>
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
            <div className="absolute inset-0 bg-gradient-to-b from-linen-deep/0 via-midnight/25 to-midnight" aria-hidden="true" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-linen-deep to-transparent" aria-hidden="true" />
          </figure>
          <div className="m-container relative -mt-24 sm:-mt-28 pb-20 md:pb-28 grid md:grid-cols-[1fr_auto] gap-8 md:gap-16 items-end">
            <div>
              <h2 id="final-heading" className="font-display font-medium text-m-section max-w-[18ch] [text-wrap:balance]">
                Your next opportunity starts with being ready for it.
              </h2>
              <p className="text-m-lead text-paper/80 mt-5 max-w-xl">
                Build your Business Passport today. It&apos;s free, and you can start with what you have.
              </p>
            </div>
            <Link href="/register?role=entrepreneur" className="m-btn-on-dark w-full md:w-auto !min-h-[52px] !px-7 !text-base">
              Create your Business Passport
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
