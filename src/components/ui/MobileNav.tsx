"use client";

// Public-site menu below the lg breakpoint (where the inline nav links no
// longer fit). Escape and the backdrop close it, focus moves into the panel
// on open and back to the toggle on close, and page scroll is locked while
// it is open. On phones a "Get started" button stays visible beside the
// toggle so registration is never hidden behind the menu.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavLink {
  href: string;
  label: string;
}

export function MobileNavToggle({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Close on route change — render-time state adjustment (React's
  // sanctioned alternative to setState-in-effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) buttonRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      // Keep Tab inside the open panel.
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight";

  return (
    <div className="lg:hidden ml-auto md:ml-0 flex items-center gap-2">
      <Link href="/register?role=entrepreneur" className="md:hidden m-btn-primary !min-h-[44px] !px-4 !text-sm">
        Get started
      </Link>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center w-11 h-11 -mr-2 rounded-[6px] text-midnight hover:bg-midnight/[0.05] ${focusRing}`}
      >
        <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
          <path d="M0 1H22M0 8H22M0 15H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-midnight/50 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="site-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-x-0 top-0 z-50 bg-linen px-5 sm:px-8 pt-4 pb-8 max-h-[100dvh] overflow-y-auto border-b border-midnight/10"
          >
            <div className="flex items-center justify-between h-[56px] mb-2">
              <span className="m-eyebrow">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className={`flex items-center justify-center w-11 h-11 -mr-2 rounded-[6px] text-midnight ${focusRing}`}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M1 1L19 19M19 1L1 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav aria-label="Main" className="flex flex-col mb-8">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={`flex min-h-[52px] items-center border-b border-midnight/10 font-display text-xl text-midnight ${focusRing}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-3">
              <Link href="/register?role=entrepreneur" className="m-btn-primary w-full">Create your Passport</Link>
              <Link
                href="/login"
                className={`m-btn w-full border border-midnight/25 text-midnight hover:border-midnight ${focusRing}`}
              >
                Log in
              </Link>
              <Link href="/register?role=institution" className="m-link self-center mt-2">Register an institution</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
