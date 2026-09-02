import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloStatus, SitheloButton } from "@/components/ui/sithelo";

// ====================================================================
// /institution/opportunities
//
// Full listing of the caller's own opportunities (the dashboard only
// shows the 5 most recent). Scoped to institution_id via RLS the same
// way as the dashboard and detail queries — real data, no invented
// rows.
// ====================================================================

const NAV_ITEMS = [
  { label: "Home", href: "/institution/dashboard" },
  { label: "Discover Businesses", href: "/institution/search" },
  { label: "Opportunities", href: "/institution/opportunities", active: true },
];

export default async function InstitutionOpportunitiesPage() {
  const { profile } = await requireInstitution();
  const supabase = await createClient();

  const { data: opportunities, error } = await supabase
    .from("opportunities")
    .select("id, title, category, province, businesses_needed, closing_date, status")
    .eq("institution_id", profile.institution_id)
    .order("created_at", { ascending: false });

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Procurement Officer">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Opportunities</h1>
          <p className="text-ink-600 mt-1">Every procurement, funding or partnership opportunity you&apos;ve posted.</p>
        </div>
        <SitheloButton href="/institution/opportunities/new">Post an opportunity</SitheloButton>
      </div>

      {error && (
        <div className="card text-center py-14">
          <p className="text-sm text-ink-600">We couldn&apos;t load your opportunities right now. Please try again.</p>
        </div>
      )}

      {!error && (!opportunities || opportunities.length === 0) && (
        <SitheloEmptyState
          title="No opportunities yet"
          body="Once you post a procurement, funding or partnership opportunity, it will appear here alongside matched businesses."
          actionLabel="Post an opportunity"
          actionHref="/institution/opportunities/new"
        />
      )}

      {!error && opportunities && opportunities.length > 0 && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-600 uppercase tracking-wide border-b border-line">
                <th className="pb-3 font-medium">Opportunity</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium">Location</th>
                <th className="pb-3 font-medium">Businesses needed</th>
                <th className="pb-3 font-medium">Closing date</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="py-3 font-medium text-navy">
                    <Link href={`/institution/opportunities/${o.id}`} className="hover:text-cobalt">
                      {o.title}
                    </Link>
                  </td>
                  <td className="py-3 text-ink-600">{o.category ?? "—"}</td>
                  <td className="py-3 text-ink-600">{o.province ?? "—"}</td>
                  <td className="py-3 text-ink-600">{o.businesses_needed ?? "—"}</td>
                  <td className="py-3 text-ink-600">{o.closing_date ? new Date(o.closing_date).toLocaleDateString("en-ZA") : "—"}</td>
                  <td className="py-3"><SitheloStatus status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}
