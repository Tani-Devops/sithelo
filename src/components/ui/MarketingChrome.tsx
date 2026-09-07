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
    <nav className="flex items-center justify-between px-6 md:px-8 py-5 max-w-[1180px] mx-auto">
      <Link href="/" aria-label="Sithelo home" className="shrink-0">
        <SitheloLogo height={38} />
      </Link>
      <div className="hidden md:flex gap-9 text-[13px] font-medium tracking-wide uppercase text-navy/70">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-blue-600 transition-colors">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="hidden md:flex gap-3">
        <SitheloButton variant="ghost" href="/login" className="!px-5 !py-2">Login</SitheloButton>
        <SitheloButton href="/register" className="!px-5 !py-2">Register</SitheloButton>
      </div>
      <MobileNavToggle links={NAV_LINKS} />
    </nav>
  );
}

/** A dark variant of the nav that sits directly over hero photography. */
export function SiteNavOnDark() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-6 md:px-8 py-6 max-w-[1180px] mx-auto">
      <Link href="/" aria-label="Sithelo home" className="shrink-0">
        <SitheloLogo height={38} variant="light" />
      </Link>
      <div className="hidden md:flex gap-9 text-[13px] font-medium tracking-wide uppercase text-white/70">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
            {l.label}
          </Link>
        ))}
      </div>
      <div className="hidden md:flex gap-3">
        <SitheloButton variant="on-dark-ghost" href="/login" className="!px-5 !py-2">Login</SitheloButton>
        <SitheloButton variant="on-dark" href="/register" className="!px-5 !py-2">Register</SitheloButton>
      </div>
      <MobileNavToggle links={NAV_LINKS} dark />
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="container-editorial py-16 grid gap-12 md:grid-cols-4">
        <div>
          <SitheloLogo height={30} variant="light" />
          <p className="text-sm text-white/55 mt-4 max-w-xs leading-relaxed">
            Where South African businesses become visible, credible and connected to opportunity.
          </p>
        </div>
        <div>
          <div className="eyebrow-on-dark mb-4">Platform</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/for-entrepreneurs" className="hover:text-white">For Entrepreneurs</Link></li>
            <li><Link href="/for-institutions" className="hover:text-white">For Institutions</Link></li>
            <li><Link href="/resources" className="hover:text-white">Resources</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow-on-dark mb-4">Company</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/register" className="hover:text-white">Register</Link></li>
            <li><Link href="/login" className="hover:text-white">Login</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow-on-dark mb-4">Legal</div>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-editorial py-6 border-t border-white/10 text-xs text-white/50">
        © {new Date().getFullYear()} Sithelo Group Holdings (Pty) Ltd. All rights reserved.
      </div>
    </footer>
  );
}
