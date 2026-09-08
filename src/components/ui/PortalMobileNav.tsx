"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SitheloLogo, SitheloAvatar } from "@/components/ui/sithelo";
import { LogoutButton } from "@/components/ui/LogoutButton";

interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

// The portal sidebar (aside in PortalShell) is hidden below md and this
// renders instead — same focus-trap / Escape / scroll-lock behaviour as
// the marketing MobileNavToggle, so dashboard users get equivalent
// keyboard and screen-reader support on small screens.
export function PortalMobileNav({
  portalLabel,
  navItems,
  userName,
  userRole,
}: {
  portalLabel: string;
  navItems: NavItem[];
  userName: string;
  userRole: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="md:hidden bg-navy-900 sticky top-0 z-30">
      <div className="flex items-center justify-between px-5 py-4">
        <SitheloLogo height={34} variant="light" />
        <button
          ref={buttonRef}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="portal-mobile-nav-panel"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center w-11 h-11 -mr-2 text-white"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M1 1L19 19M19 1L1 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="15" viewBox="0 0 20 15" fill="none" aria-hidden="true">
              <path d="M0 1H20M0 7.5H20M0 14H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 bg-navy/60 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="portal-mobile-nav-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${portalLabel} menu`}
            className="fixed inset-x-0 top-0 z-50 bg-navy-900 shadow-lift px-5 pt-5 pb-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="eyebrow-on-dark">{portalLabel}</div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-11 h-11 -mr-2 text-white"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 mb-6">
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
            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <SitheloAvatar name={userName} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm font-medium leading-tight truncate">{userName}</div>
                <div className="text-white/50 text-xs">{userRole}</div>
              </div>
              <LogoutButton variant="dark" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
