import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloBadge } from "@/components/ui/sithelo";

// ====================================================================
// DATA SOURCE: public.opportunities, filtered by RLS policy
// "opportunities: entrepreneurs read active" (status = 'active' only —
// entrepreneurs never see draft/closed/cancelled/awarded opportunities
// via this query, enforced at the database layer, not filtered here).
// Cross-referenced against the caller's own applications (if they have
// a Business Passport) to show "Already applied" instead of a
// duplicate-apply affordance — real data, not a guess.
// ====================================================================

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  procurement: "Procurement", funding: "Funding",
  enterprise_development: "Enterprise Development", partnership: "Partnership",
};

export default async function OpportunitiesPage() {
  const { userId, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: opportunities, error } = await supabase
    .from("opportunities")
    .select("id, title, opportunity_type, category, description, province, municipality, businesses_needed, value_estimate, closing_date, institutions(name)")
    .eq("status", "active")
    .order("closing_date", { ascending: true, nullsFirst: false });

  const { data: passport } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: myApplications } = passport
    ? await supabase.from("applications").select("opportunity_id").eq("passport_id", passport.id)
    : { data: [] };
  const appliedIds = new Set((myApplications ?? []).map((a) => a.opportunity_id));

  const NAV_ITEMS = [
    { label: "Home", href: "/entrepreneur/dashboard" },
    { label: "Business Passport", href: "/entrepreneur/business" },
    { label: "My Journey", href: "/entrepreneur/journey" },
    { label: "Opportunities", href: "/entrepreneur/opportunities", active: true },
  ];

  return (
    <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Entrepreneur">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Opportunities</h1>
        <p className="text-ink-600 mt-1">Real procurement, funding and partnership opportunities from verified institutions.</p>
      </div>

      {error && (
        <div className="card text-center py-14">
          <p className="text-sm text-ink-600">We couldn&apos;t load opportunities right now. Please try again.</p>
        </div>
      )}

      {!error && (!opportunities || opportunities.length === 0) && (
        <SitheloEmptyState
          title="No opportunities yet"
          body="When institutions post procurement, funding or partnership opportunities, they'll appear here, matched to your Business Passport where possible."
        />
      )}

      {!error && opportunities && opportunities.length > 0 && (
        <div className="grid md:grid-cols-2 gap-5">
          {opportunities.map((opp) => {
            const inst = Array.isArray(opp.institutions) ? opp.institutions[0] : opp.institutions;
            const alreadyApplied = appliedIds.has(opp.id);
            return (
              <div key={opp.id} className="card flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <SitheloBadge tone="info">{OPPORTUNITY_TYPE_LABELS[opp.opportunity_type] ?? opp.opportunity_type}</SitheloBadge>
                  {opp.value_estimate && (
                    <span className="text-sm font-display font-bold text-cobalt">
                      R{(opp.value_estimate / 1000000).toFixed(1)}M
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-display font-semibold text-navy mb-2 leading-snug">{opp.title}</h2>
                <p className="text-sm text-ink-600 mb-4 line-clamp-2 flex-1">{opp.description ?? "No further description provided."}</p>
                <div className="text-xs text-ink-600 space-y-1 mb-4">
                  <div>{opp.category ?? "—"} · {opp.municipality ?? opp.province ?? "South Africa"}</div>
                  <div>{inst?.name ?? "Institution"} {opp.businesses_needed ? `· ${opp.businesses_needed} businesses needed` : ""}</div>
                  {opp.closing_date && <div>Closing {new Date(opp.closing_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div>}
                </div>
                {alreadyApplied ? (
                  <SitheloBadge tone="verified">Already applied</SitheloBadge>
                ) : (
                  <span className="text-sm font-semibold text-cobalt">View opportunity →</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
