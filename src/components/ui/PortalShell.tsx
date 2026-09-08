import Link from "next/link";
import { SitheloAvatar, SitheloLogo } from "./sithelo";
import { PortalMobileNav } from "./PortalMobileNav";
import { LogoutButton } from "./LogoutButton";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export function PortalShell({
  portalLabel,
  navItems,
  userName,
  userRole,
  children,
}: {
  portalLabel: string;
  navItems: NavItem[];
  userName: string;
  userRole: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-ivory">
      <PortalMobileNav portalLabel={portalLabel} navItems={navItems} userName={userName} userRole={userRole} />
      <aside className="hidden md:flex w-[248px] flex-col shrink-0 bg-navy-900">
        <div className="px-6 py-8 border-b border-white/10 flex flex-col items-center text-center">
          <SitheloLogo height={44} variant="light" />
          <div className="eyebrow-on-dark mt-3">{portalLabel}</div>
        </div>
        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={item.active ? "sidebar-link-active" : "sidebar-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <SitheloAvatar name={userName} size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium leading-tight truncate">{userName}</div>
            <div className="text-white/50 text-xs">{userRole}</div>
          </div>
          <LogoutButton variant="dark" />
        </div>
      </aside>
      <main id="main-content" className="flex-1 px-6 md:px-12 py-8 md:py-10 overflow-x-hidden max-w-[1100px]">{children}</main>
    </div>
  );
}
