import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloMetric, SitheloStatus } from "@/components/ui/sithelo";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard", active: true },
  { label: "Verification Queue", href: "/admin/verification" },
];

export default async function AdminDashboard() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const { count: totalBusinesses } = await supabase
    .from("business_passports").select("id", { count: "exact", head: true });
  const { count: verifiedBusinesses } = await supabase
    .from("business_passports").select("id", { count: "exact", head: true }).eq("overall_verification_status", "verified");
  const { count: activeOpportunities } = await supabase
    .from("opportunities").select("id", { count: "exact", head: true }).eq("status", "active");
  const { count: pendingVerifications } = await supabase
    .from("verifications").select("id", { count: "exact", head: true }).eq("status", "pending");

  const { data: recentOpportunities } = await supabase
    .from("opportunities")
    .select("id, title, institution_id, status, created_at, institutions(name)")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <PortalShell portalLabel="Admin" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Super Admin">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-navy">Overview</h1>
        <p className="text-sm text-ink-600 mt-1">Platform-wide activity across Sithelo.</p>
      </div>

      <div className="grid grid-cols-4 gap-5 mb-8">
        <div className="card"><SitheloMetric label="Total businesses" value={totalBusinesses ?? 0} /></div>
        <div className="card"><SitheloMetric label="Verified businesses" value={verifiedBusinesses ?? 0} /></div>
        <div className="card"><SitheloMetric label="Active opportunities" value={activeOpportunities ?? 0} /></div>
        <div className="card"><SitheloMetric label="Pending verifications" value={pendingVerifications ?? 0} /></div>
      </div>

      <div className="card">
        <h2 className="text-lg font-display font-semibold text-navy mb-4">Recent opportunities</h2>
        {recentOpportunities && recentOpportunities.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-600 uppercase tracking-wide border-b border-line">
                <th className="pb-3 font-medium">Opportunity</th>
                <th className="pb-3 font-medium">Institution</th>
                <th className="pb-3 font-medium">Posted</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOpportunities.map((o) => {
                const inst = Array.isArray(o.institutions) ? o.institutions[0] : o.institutions;
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="py-3 font-medium text-navy">{o.title}</td>
                    <td className="py-3 text-ink-600">{inst?.name ?? "—"}</td>
                    <td className="py-3 text-ink-600">{new Date(o.created_at).toLocaleDateString("en-ZA")}</td>
                    <td className="py-3"><SitheloStatus status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-600">No opportunities yet.</p>
        )}
      </div>
    </PortalShell>
  );
}
