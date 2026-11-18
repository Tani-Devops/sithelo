import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/ui/MarketingChrome";
import { DirectorySearchExample } from "@/components/marketing/DirectorySearchExample";
import { PassportCredential } from "@/components/marketing/PassportCredential";
import { SouthAfricaMap } from "@/components/marketing/SouthAfricaMap";
import { LEGAL_CONFIG } from "@/lib/legal/config";

export const metadata: Metadata = {
  title: "For Institutions | Sithelo",
  description:
    "Search and shortlist verified, capacity-ready South African businesses through the Business Passport, with due diligence built in.",
  alternates: { canonical: "/for-institutions" },
};

// Claims on this page match /institution/search and the institution
// portal as built: search by name, industry and province; verification
// status per record; shortlisting; opportunities published once Sithelo
// approves the institution. "Talk to us" appears only when a monitored
// contact address is configured (LEGAL_CONFIG.contactEmail).

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

const VERIFICATIONS = ["CIPC", "SARS", "VAT", "B-BBEE", "CIDB", "Municipal supplier"];

export default function ForInstitutionsPage() {
  const contact = LEGAL_CONFIG.contactEmail;
  return (
    <>
      <SiteNav />
      <main id="main-content" className="bg-linen text-midnight">
        {/* ================= HERO: the search itself ================= */}
        <section aria-labelledby="hero-heading" className="m-container pt-12 pb-20 lg:py-16 lg:min-h-[clamp(620px,calc(100svh-84px),760px)] lg:flex lg:items-center">
          <div className="w-full grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-12 lg:gap-16 items-center">
            <div>
              <h1 id="hero-heading" className="font-display font-medium text-m-hero text-midnight max-w-[11ch] [overflow-wrap:break-word] min-w-0">
                Find businesses you can verify.
              </h1>
              <p className="m-lead mt-6 max-w-[30rem]">
                Search South African businesses by industry, province and name, then see what has been checked.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link href="/register?role=institution" className="m-btn-primary w-full sm:w-auto whitespace-nowrap !min-h-[52px] !px-7 !text-base">
                  Register your institution
                </Link>
                {contact && (
                  <a href={`mailto:${contact}?subject=Sithelo%20for%20our%20institution`} className="m-btn-glass w-full sm:w-auto whitespace-nowrap !min-h-[52px]">
                    Talk to us
                  </a>
                )}
              </div>
            </div>
            <DirectorySearchExample />
          </div>
        </section>

        {/* ================= DUE DILIGENCE: the Passport, read by an institution ================= */}
        <section aria-labelledby="diligence-heading" className="bg-midnight text-paper">
          <div className="m-container m-section grid lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-14 lg:gap-24 items-center">
            <div className="max-w-[420px] w-full mx-auto lg:mx-0 order-2 lg:order-1">
              <PassportCredential />
            </div>
            <div className="order-1 lg:order-2">
              <h2 id="diligence-heading" className="font-display font-medium text-m-section max-w-[14ch]">
                Verified, not just claimed.
              </h2>
              <p className="text-m-lead text-paper/80 mt-6 max-w-md">
                Every record shows whether Sithelo has verified it, is reviewing it, or when it expires.
              </p>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 font-display text-m-title text-paper/90" aria-label="Verification types">
                {VERIFICATIONS.map((v) => <li key={v}>{v}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* ================= SHORTLIST AND PUBLISH ================= */}
        <section aria-labelledby="work-heading" className="bg-linen">
          <div className="m-container m-section">
            <h2 id="work-heading" className="m-heading max-w-[18ch]">From a shortlist to an award.</h2>
            <div className="mt-14 grid md:grid-cols-2 gap-x-16 gap-y-12">
              <div className="border-t-2 border-copper pt-6">
                <h3 className="font-display text-m-title text-midnight">Shortlist with confidence</h3>
                <p className="text-[1.0625rem] text-ink-700 mt-3 leading-relaxed max-w-md">
                  Keep the businesses you want to follow in one list, chosen on what was verified.
                </p>
              </div>
              <div className="border-t-2 border-copper pt-6">
                <h3 className="font-display text-m-title text-midnight">Publish opportunities</h3>
                <p className="text-[1.0625rem] text-ink-700 mt-3 leading-relaxed max-w-md">
                  Once Sithelo approves your institution, post funding, procurement or enterprise
                  development work, then shortlist, reject or award applications.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= COVERAGE: the nine provinces ================= */}
        <section aria-labelledby="coverage-heading" className="relative isolate overflow-hidden bg-linen-deep">
          <SouthAfricaMap className="pointer-events-none absolute -z-10 text-copper/[0.12] w-[680px] -right-24 top-1/2 -translate-y-1/2 hidden md:block" />
          <div className="m-container m-section">
            <h2 id="coverage-heading" className="m-heading max-w-[16ch]">Search by province.</h2>
            <ul className="mt-12 grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-5 max-w-3xl font-display text-m-title text-midnight min-w-0">
              {PROVINCES.map((p) => <li key={p} className="border-t border-midnight/15 pt-4">{p}</li>)}
            </ul>
          </div>
        </section>

        {/* ================= CLOSE ================= */}
        <section aria-labelledby="final-heading" className="bg-midnight text-paper">
          <div className="m-container py-20 md:py-28 grid md:grid-cols-[minmax(0,1fr)_auto] gap-8 md:gap-16 items-end">
            <h2 id="final-heading" className="font-display font-medium text-m-section max-w-[16ch]">
              Start with businesses you can check.
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link href="/register?role=institution" className="m-btn-on-dark w-full sm:w-auto whitespace-nowrap !min-h-[52px] !px-7 !text-base">
                Register your institution
              </Link>
              {contact && (
                <a href={`mailto:${contact}?subject=Sithelo%20for%20our%20institution`} className="m-btn-glass-dark w-full sm:w-auto whitespace-nowrap !min-h-[52px]">
                  Talk to us
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
