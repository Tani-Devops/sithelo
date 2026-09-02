import Link from "next/link";
import { SitheloLogo, SitheloButton } from "@/components/ui/sithelo";
import { MobileNavToggle } from "@/components/ui/MobileNav";

const NAV_LINKS = [
  { href: "/for-entrepreneurs", label: "For Entrepreneurs" },
  { href: "/for-institutions", label: "For Institutions" },
  { href: "/about", label: "About" },
  { href: "/resources", label: "Resources" },
];

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between px-6 md:px-8 py-6 max-w-[1280px] mx-auto">
      <Link href="/" aria-label="Sithelo home" className="shrink-0">
        <SitheloLogo height={34} />
      </Link>
      <div className="hidden md:flex gap-8 text-sm font-medium text-navy/80">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-cobalt transition-colors">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="hidden md:flex gap-3">
        <SitheloButton variant="ghost" href="/login">Login</SitheloButton>
        <SitheloButton href="/register">Register</SitheloButton>
      </div>
      <MobileNavToggle links={NAV_LINKS} />
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-[1280px] mx-auto px-8 py-12 grid gap-10 md:grid-cols-4">
        <div>
          <SitheloLogo height={26} />
          <p className="text-sm text-ink-600 mt-4 max-w-xs leading-relaxed">
            Helping entrepreneurs turn effort into results.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-600 mb-3">Platform</div>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><Link href="/for-entrepreneurs" className="hover:text-cobalt">For Entrepreneurs</Link></li>
            <li><Link href="/for-institutions" className="hover:text-cobalt">For Institutions</Link></li>
            <li><Link href="/resources" className="hover:text-cobalt">Resources</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-600 mb-3">Company</div>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><Link href="/about" className="hover:text-cobalt">About</Link></li>
            <li><Link href="/register" className="hover:text-cobalt">Register</Link></li>
            <li><Link href="/login" className="hover:text-cobalt">Login</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-600 mb-3">Legal</div>
          <ul className="space-y-2 text-sm text-ink-600">
            <li><Link href="/terms" className="hover:text-cobalt">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-cobalt">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1280px] mx-auto px-8 py-6 border-t border-line text-xs text-ink-600">
        © {new Date().getFullYear()} Sithelo Group Holdings (Pty) Ltd. All rights reserved.
      </div>
    </footer>
  );
}
