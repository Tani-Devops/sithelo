import { SitheloAvatar, SitheloLogo } from "./sithelo";
import { PortalMobileNav } from "./PortalMobileNav";
import { PortalNavLinks } from "./PortalNavLinks";
import { LogoutButton } from "./LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_LABEL, PORTAL_NAV } from "@/lib/portalNav";
import type { UserRole } from "@/types/database";
import type { ReactNode } from "react";

// Layout for every signed-in page. The nav comes from PORTAL_NAV for the
// given portal, and the active item from the URL, so pages pass only who
// they are for. The unread count is RLS-scoped to the signed-in user.
export async function PortalShell({
  portal,
  userName,
  children,
}: {
  portal: UserRole;
  userName: string;
  children: ReactNode;
}) {
  const navItems = PORTAL_NAV[portal];
  const portalLabel = PORTAL_LABEL[portal];

  let unread = 0;
  if (navItems.some((i) => i.href === "/notifications")) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);
    unread = count ?? 0;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-ivory">
      <PortalMobileNav portalLabel={portalLabel} navItems={navItems} userName={userName} userRole={portalLabel} />
      <aside className="hidden md:flex w-[248px] flex-col shrink-0 bg-navy-900 sticky top-0 h-screen">
        <div className="px-6 py-8 border-b border-white/10 flex flex-col items-center text-center">
          <SitheloLogo height={44} variant="light" />
          <div className="eyebrow-on-dark mt-3">{portalLabel}</div>
        </div>
        <nav aria-label={`${portalLabel} navigation`} className="flex-1 px-3 pt-4 space-y-0.5 overflow-y-auto">
          <PortalNavLinks items={navItems} unread={unread} />
        </nav>
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <SitheloAvatar name={userName} size={34} />
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-medium leading-tight truncate">{userName}</div>
            <div className="text-white/50 text-xs">{portalLabel}</div>
          </div>
          <LogoutButton variant="dark" />
        </div>
      </aside>
      <main id="main-content" className="flex-1 min-w-0 px-5 sm:px-6 md:px-12 py-8 md:py-10">
        <div className="max-w-[1100px]">{children}</div>
      </main>
    </div>
  );
}
