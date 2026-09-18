"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SitheloLogo } from "@/components/ui/sithelo";
import { PassportPreview } from "./PassportPreview";
import { IconChevronRight, IconMenu, IconX } from "./icons";
import { enter } from "@/lib/motion/enter";

const NAV_LINKS = [
  { href: "/for-entrepreneurs", label: "For Entrepreneurs" },
  { href: "/for-institutions", label: "For Institutions" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Resources" },
];

// The previous image here (and in "Meet the Businesses" below) carried a
// code comment claiming it was "already-verified South African" — that
// claim was never actually substantiated and the photo does not depict a
// verifiably South African scene. Replaced with a photo from Vije
// Vijendranath, an Unsplash photographer whose profile states he lives in
// Johannesburg, South Africa (a real, checkable claim, not a keyword tag) —
// taken at Johannesburg's Rosebank Sunday Market. This changes the
// composition from a single-vendor portrait to a market scene; see
// FINAL_HARDENING_REPORT-style note in chat for why a portrait-style
// replacement could not be sourced with the same confidence.
const HERO_IMAGE = "https://images.unsplash.com/photo-1692689383052-9fbf3d1c0969?auto=format&fit=crop&w=2400&q=80";

export function Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  // The site's one orchestrated page-load moment: nav, badge, headline,
  // subtitle and CTA stagger in together. Native WAAPI, opacity + transform
  // only — everything else on the page stays still.
  useEffect(() => {
    enter(navRef.current, { delay: 0, distance: 10 });
    enter(badgeRef.current, { delay: 80 });
    enter(headlineRef.current, { delay: 160, distance: 20 });
    enter(subtitleRef.current, { delay: 260 });
    enter(ctaRef.current, { delay: 340 });
  }, []);

  return (
    <div className="min-h-screen w-full bg-ivory p-3 sm:p-4">
      <div className="relative w-full h-[calc(100vh-24px)] sm:h-[calc(100vh-32px)] overflow-hidden bg-navy-900 rounded-2xl sm:rounded-3xl">
        {/* Background photography */}
        <Image
          src={HERO_IMAGE}
          alt="A weekend market in Johannesburg, South Africa"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(8,22,37,0.55) 0%, rgba(8,22,37,0.35) 45%, rgba(8,22,37,0.85) 100%)" }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Navbar */}
          <div ref={navRef} className="flex justify-center pt-4 sm:pt-6 px-3 sm:px-4">
            <div className="bg-white rounded-full shadow-sm border border-line pl-2 pr-2 py-2 w-full max-w-[760px] relative">
              <div className="flex items-center">
                <Link href="/" aria-label="Sithelo home" className="shrink-0 pl-2">
                  <SitheloLogo height={26} />
                </Link>

                <div className="hidden md:flex items-center gap-6 mx-auto text-[14px] font-medium text-navy/80">
                  {NAV_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className="hover:text-navy transition-colors">
                      {l.label}
                    </Link>
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <Link
                    href="/register?role=entrepreneur"
                    className="inline-flex items-center gap-3 bg-blue-600 text-white rounded-full pl-4 sm:pl-5 pr-2 py-2 text-[13px] sm:text-[14px] font-medium transition-all duration-200 ease-brand hover:bg-blue-700 hover:-translate-y-0.5"
                  >
                    <span className="hidden sm:inline">Create your profile</span>
                    <span className="sm:hidden">Get started</span>
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <IconChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={menuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="md:hidden w-9 h-9 flex items-center justify-center text-navy shrink-0"
                  >
                    {menuOpen ? <IconX /> : <IconMenu />}
                  </button>
                </div>
              </div>

              {menuOpen && (
                <div className="md:hidden absolute top-full left-2 right-2 mt-2 bg-white rounded-2xl shadow-lg border border-line p-3 z-20 origin-top animate-reveal">
                  <nav className="flex flex-col">
                    {NAV_LINKS.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setMenuOpen(false)}
                        className="py-2.5 px-2 text-sm font-medium text-navy border-b border-line last:border-b-0"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <Link href="/login" onClick={() => setMenuOpen(false)} className="py-2.5 px-2 text-sm font-medium text-navy">
                      Login
                    </Link>
                  </nav>
                </div>
              )}
            </div>
          </div>

          {/* Hero content */}
          <div className="flex flex-col items-center px-4 pt-10 sm:pt-16 pb-8 sm:pb-12 text-center">
            <div ref={badgeRef} className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-sm text-[13px] font-medium text-navy">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Sithelo Business Passport
            </div>

            <h1
              ref={headlineRef}
              className="mt-5 sm:mt-6 max-w-4xl text-white font-medium"
              style={{ fontSize: "clamp(36px, 8vw, 72px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
            >
              Turning effort into
              <br />
              <span style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 400 }}>opportunity</span>
            </h1>

            <p ref={subtitleRef} className="mt-4 sm:mt-6 text-white/75 px-2 max-w-xl" style={{ fontSize: "clamp(13px, 3.5vw, 16px)" }}>
              One verified Business Passport for every opportunity — procurement, funding and
              partnerships across South Africa.
            </p>

            <Link
              ref={ctaRef}
              href="/register?role=entrepreneur"
              className="mt-6 sm:mt-8 inline-flex items-center gap-3 bg-white text-navy rounded-full pl-6 sm:pl-7 pr-2 py-2 sm:py-2.5 text-[14px] font-medium transition-all duration-200 ease-brand hover:bg-white/90 hover:-translate-y-0.5"
            >
              Get Started
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-navy/10 flex items-center justify-center shrink-0">
                <IconChevronRight className="w-4 h-4" />
              </span>
            </Link>
          </div>

          {/* Passport preview — deliberately bleeds off the rounded hero's
              bottom edge, clipped by the hero's own overflow-hidden. */}
          <div className="mt-auto translate-y-1/2">
            <PassportPreview />
          </div>
        </div>
      </div>
    </div>
  );
}
