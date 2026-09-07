import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloBadge } from "@/components/ui/sithelo";

// ====================================================================
// /institution/opportunities/[id]
//
// "Potential matches" reads public.matches joined against
// public.institution_business_directory (migration 007) — NEVER
// business_passports directly. That view is the deliberate data-
// minimization boundary (directive §14/§17): no household income,
// no dependants, no personal expenses, no debt, no private contact
// fields. Match score/reasons come from matches, computed server-side
// by match-businesses — never fabricated here.
// ====================================================================

const NAV_ITEMS = [
  { label: "Home", href: "/institution/dashboard" },
  { label: "Discover Businesses", href: "/institution/search" },
  { label: "Opportunities", href: "/institution/opportunities", active: true },
];

export default async function InstitutionOpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireInstitution();
  const supabase = await createClient();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, title, opportunity_type, category, description, province, municipality, businesses_needed, closing_date, status, requirements, institution_id")
    .eq("id", id)
    .maybeSingle();

  // RLS already scopes opportunities to the caller's own institution for
  // non-admin roles, but a 404 on no-row is still correct UX regardless
  // of whether that's an RLS miss or a genuinely bad id.
  if (!opportunity) notFound();

  const { data: matches } = await supabase
    .from("matches")
    .select("match_score, match_reasons, passport_id")
    .eq("opportunity_id", id)
    .order("match_score", { ascending: false })
    .limit(50);

  const passportIds = (matches ?? []).map((m) => m.passport_id);
  const { data: directory } = passportIds.length
    ? await supabase
        .from("institution_business_directory")
        .select("id, business_name, industry, province, municipality, trust_score, overall_verification_status, capacity_range, employees_count")
        .in("id", passportIds)
    : { data: [] };

  const directoryById = new Map((directory ?? []).map((d) => [d.id, d]));
  const rows = (matches ?? [])
    .map((m) => ({ match: m, business: directoryById.get(m.passport_id) }))
    .filter((r): r is { match: typeof r.match; business: NonNullable<typeof r.business> } => Boolean(r.business));

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Institution">
      <div className="mb-10 rule border-b pb-8">
        <SitheloBadge tone={opportunity.status === "active" ? "verified" : "pending"}>{opportunity.status}</SitheloBadge>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight mt-4">{opportunity.title}</h1>
        <p className="text-ink-600 mt-2">{opportunity.municipality ?? opportunity.province ?? "South Africa"}</p>
      </div>

      <div className="mb-8">
        <div className="text-sm text-ink-600">
          {rows.length === 0
            ? "No matching businesses yet."
            : `${rows.length} business${rows.length === 1 ? "" : "es"} may be a fit.`}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rule border-t">
          {rows.map(({ match, business }) => {
            const reasons = Array.isArray(match.match_reasons)
              ? (match.match_reasons as unknown[]).filter((r): r is string => typeof r === "string")
              : [];
            return (
              <div key={business.id} className="flex items-start justify-between gap-6 py-6 border-b border-line">
                <div>
                  <div className="font-display font-medium text-navy text-base">{business.business_name}</div>
                  <div className="text-xs text-ink-500 mt-1 mb-2">
                    {business.industry ?? "—"} · {business.municipality ?? business.province ?? "—"}
                  </div>
                  <SitheloBadge tone={business.overall_verification_status === "verified" ? "verified" : "pending"}>
                    {business.overall_verification_status === "verified" ? "Verified" : "In progress"}
                  </SitheloBadge>
                  {reasons.length > 0 && (
                    <ul className="text-sm text-verified mt-3 space-y-1">
                      {reasons.map((r, i) => <li key={i}>✓ {r}</li>)}
                    </ul>
                  )}
                </div>
                <div className="text-2xl font-display font-medium text-navy whitespace-nowrap">
                  {Math.round(match.match_score)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
