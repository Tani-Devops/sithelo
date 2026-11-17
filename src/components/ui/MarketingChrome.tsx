import Link from "next/link";
import { SitheloLogo } from "@/components/ui/sithelo";
import { MobileNavToggle } from "@/components/ui/MobileNav";
import { LEGAL_CONFIG } from "@/lib/legal/config";

// Public-site header and footer, shared by every marketing page.

export const NAV_LINKS = [
  { href: "/for-entrepreneurs", label: "Entrepreneurs" },
  { href: "/for-institutions", label: "Institutions" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Resources" },
];

/**
 * Sticky header: 72px on phones, 84px from md. The logo renders at
 * 52px / 60px tall (it was 44px), about 40–55% larger, without distortion;
 * the artwork already fills ~90% of its canvas, so size is the only lever.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-midnight/10 bg-linen/95 backdrop-blur-[6px] supports-[backdrop-filter]:bg-linen/85">
      <div className="m-container flex h-[72px] md:h-[84px] items-center gap-6">
        <Link
          href="/"
          aria-label="Sithelo home"
          className="shrink-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-midnight"
        >
          <span className="md:hidden"><SitheloLogo height={52} /></span>
          <span className="hidden md:inline"><SitheloLogo height={60} /></span>
        </Link>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-8 mx-auto text-[0.9375rem] font-medium text-midnight/80">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-[44px] items-center transition-colors duration-150 hover:text-midnight hover:underline hover:decoration-copper hover:decoration-2 hover:underline-offset-[10px] rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-midnight"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto lg:ml-0 hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center px-4 text-[0.9375rem] font-semibold text-midnight rounded-[6px] hover:bg-midnight/[0.05] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-midnight"
          >
            Log in
          </Link>
          <Link href="/register?role=entrepreneur" className="m-btn-primary !min-h-[44px] !px-5">
            Create your Passport
          </Link>
        </div>

        <MobileNavToggle links={NAV_LINKS} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  const contact = LEGAL_CONFIG.contactEmail;
  return (
    <footer className="bg-midnight text-paper">
      <div className="m-container py-16 md:py-20 grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <SitheloLogo height={56} variant="light" />
          <p className="text-[0.9375rem] text-paper/70 mt-5 max-w-xs leading-relaxed">
            Rooted in people. Built for opportunity.
          </p>
          {contact && (
            <p className="text-[0.9375rem] mt-4">
              <a href={`mailto:${contact}`} className="text-paper underline decoration-copper underline-offset-4 hover:text-copper-light">
                {contact}
              </a>
            </p>
          )}
        </div>
        <FooterColumn
          title="Platform"
          links={[
            ["/for-entrepreneurs", "For entrepreneurs"],
            ["/for-institutions", "For institutions"],
            ["/resources", "Resources"],
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            ["/register?role=entrepreneur", "Create your Passport"],
            ["/register?role=institution", "Register an institution"],
            ["/login", "Log in"],
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            ["/about", "About Sithelo"],
            ["/terms", "Terms of Service"],
            ["/privacy", "Privacy Policy"],
          ]}
        />
      </div>
      <div className="m-container py-6 border-t border-paper/10 flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] text-paper/60">
        <span>© {new Date().getFullYear()} {LEGAL_CONFIG.companyName ?? "Sithelo"}. All rights reserved.</span>
        <span>Photography under the Unsplash License, credited where shown.</span>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="m-eyebrow-on-dark mb-4">{title}</h2>
      <ul className="space-y-1">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="inline-flex min-h-[40px] items-center text-[0.9375rem] text-paper/80 hover:text-paper hover:underline hover:decoration-copper hover:underline-offset-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
