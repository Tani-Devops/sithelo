// Single source for each portal's sidebar. Pages used to declare their
// own copy of this list (13 copies), which drifted: some lacked the
// Applications link, admin pages disagreed on "Institution Approvals".
// The active item is derived from the URL (see PortalNavLinks), not
// flagged by hand on each page.
import type { UserRole } from "@/types/database";

export interface PortalNavItem {
  label: string;
  href: string;
}

export const PORTAL_NAV: Record<UserRole, PortalNavItem[]> = {
  entrepreneur: [
    { label: "Home", href: "/entrepreneur/dashboard" },
    { label: "Business Passport", href: "/entrepreneur/business" },
    { label: "My Journey", href: "/entrepreneur/journey" },
    { label: "Opportunities", href: "/entrepreneur/opportunities" },
    { label: "Applications", href: "/entrepreneur/applications" },
    { label: "Notifications", href: "/notifications" },
  ],
  institution: [
    { label: "Home", href: "/institution/dashboard" },
    { label: "Discover Businesses", href: "/institution/search" },
    { label: "Opportunities", href: "/institution/opportunities" },
    { label: "Applications", href: "/institution/applications" },
    { label: "Notifications", href: "/notifications" },
  ],
  admin: [
    { label: "Overview", href: "/admin/dashboard" },
    { label: "Verification Queue", href: "/admin/verification" },
    { label: "Institution Approvals", href: "/admin/institutions" },
  ],
};

export const PORTAL_LABEL: Record<UserRole, string> = {
  entrepreneur: "Entrepreneur",
  institution: "Institution",
  admin: "Admin",
};

/** The nav item a path belongs to: the longest href that prefixes it. */
export function activeHref(items: PortalNavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of items) {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && (!best || href.length > best.length)) {
      best = href;
    }
  }
  // The passport page is reached from "Business Passport".
  if (!best && pathname.startsWith("/passport/")) {
    best = items.find((i) => i.href === "/entrepreneur/business")?.href ?? null;
  }
  return best;
}
