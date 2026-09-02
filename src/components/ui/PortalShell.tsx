import Link from "next/link";
import { SitheloAvatar, SitheloLogo } from "./sithelo";
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
    <div className="flex min-h-screen bg-soft">
      <aside
        className="w-[264px] flex flex-col shrink-0"
        style={{ background: "linear-gradient(180deg, #10243E 0%, #18212B 100%)" }}
      >
        <div className="px-6 py-7">
          <div className="brightness-0 invert opacity-90">
            <SitheloLogo height={30} />
          </div>
          <div className="text-white/45 text-[11px] font-semibold tracking-wider uppercase mt-2">{portalLabel}</div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={item.active ? "sidebar-link-active" : "sidebar-link"}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <SitheloAvatar name={userName} size={36} />
          <div>
            <div className="text-white text-sm font-medium leading-tight">{userName}</div>
            <div className="text-white/50 text-xs">{userRole}</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
