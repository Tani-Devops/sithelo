"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeHref, type PortalNavItem } from "@/lib/portalNav";

export function PortalNavLinks({ items, unread = 0 }: { items: PortalNavItem[]; unread?: number }) {
  const pathname = usePathname();
  const current = activeHref(items, pathname);
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === current ? "page" : undefined}
          className={item.href === current ? "sidebar-link-active" : "sidebar-link"}
        >
          <span className="flex-1">{item.label}</span>
          {item.href === "/notifications" && unread > 0 && (
            <span className="text-[11px] font-semibold text-navy bg-white rounded-sm px-1.5 py-0.5 tabular-nums" aria-label={`${unread} unread`}>
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}
