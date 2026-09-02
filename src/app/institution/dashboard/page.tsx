import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloMetric, SitheloStatus, SitheloEmptyState } from "@/components/ui/sithelo";

const NAV_ITEMS = [
  { label: "Home", href: "/institution/dashboard", active: true },
  { label: "Discover Businesses", href: "/institution/search" },
  { label: "Opportunities", href: "/institution/opportunities" },
];

export default async function InstitutionDashboard() {
  const { profile } = await requireInstitution();
  const supabase = await createClient();
  const { data: institution } = await supabase.from("institutions").select("name").eq("id", profile.institution_id!).single();

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, title, category, province, businesses_needed, closing_date, status")
    .eq("institution_id", profile.institution_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: activeCount } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", profile.institution_id)
    .eq("status", "active");

  const { count: shortlistedCount } = await supabase
    .from("shortlists")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", profile.institution_id);

  const oppIds = (opportunities ?? []).map((o) => o.id);
  const { count: matchesCount } = oppIds.length
    ? await supabase.from("matches").select("id", { count: "exact", head: true }).in("opportunity_id", oppIds)
    : { count: 0 };

  const { count: contractsCount } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "awarded")
    .in("opportunity_id", oppIds.length ? oppIds : ["00000000-0000-0000-0000-000000000000"]);

  const institutionName = institution?.name ?? "your institution";
  const firstName = profile.full_name.split(" ")[0];

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Procurement Officer">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Welcome back, {firstName}.</h1>
        <p className="text-ink-600 mt-1">Here&apos;s what&apos;s happening with {institutionName}&apos;s opportunities.</p>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-8">
        <div className="card"><SitheloMetric label="Active opportunities" value={activeCount ?? 0} /></div>
        <div className="card"><SitheloMetric label="Matches found" value={matchesCount ?? 0} /></div>
        <div className="card"><SitheloMetric label="Shortlisted businesses" value={shortlistedCount ?? 0} /></div>
        <div className="card"><SitheloMetric label="Contracts awarded" value={contractsCount ?? 0} /></div>
        <div className="card"><SitheloMetric label="Total opportunities" value={opportunities?.length ?? 0} /></div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-semibold text-navy">Recent opportunities</h2>
          <Link href="/institution/opportunities" className="text-sm text-cobalt font-medium">View all</Link>
        </div>
        {opportunities && opportunities.length > 0 ? (
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
                  <td className="py-3 font-medium text-navy">{o.title}</td>
                  <td className="py-3 text-ink-600">{o.category ?? "—"}</td>
                  <td className="py-3 text-ink-600">{o.province ?? "—"}</td>
                  <td className="py-3 text-ink-600">{o.businesses_needed ?? "—"}</td>
                  <td className="py-3 text-ink-600">{o.closing_date ? new Date(o.closing_date).toLocaleDateString("en-ZA") : "—"}</td>
                  <td className="py-3"><SitheloStatus status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <SitheloEmptyState
            title="No opportunities yet"
            body="Once you post a procurement, funding or partnership opportunity, it will appear here alongside matched businesses."
            actionLabel="Post an opportunity"
            actionHref="/institution/opportunities/new"
          />
        )}
      </div>
    </PortalShell>
  );
}
