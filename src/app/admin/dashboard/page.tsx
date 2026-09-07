import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloStatus } from "@/components/ui/sithelo";

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
      <div className="mb-10">
        <div className="eyebrow mb-3">Admin</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Overview</h1>
        <p className="text-sm text-ink-600 mt-2">Platform-wide activity across Sithelo.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 rule border-y mb-10">
        {[
          ["Total businesses", totalBusinesses ?? 0],
          ["Verified businesses", verifiedBusinesses ?? 0],
          ["Active opportunities", activeOpportunities ?? 0],
          ["Pending verifications", pendingVerifications ?? 0],
        ].map(([label, value], i) => (
          <div key={label as string} className={`py-6 pr-4 ${i > 0 ? "sm:border-l border-line sm:pl-6" : ""} ${i >= 2 ? "border-t sm:border-t-0 border-line" : ""}`}>
            <div className="text-2xl font-display font-medium text-navy">{value}</div>
            <div className="text-eyebrow text-ink-500 mt-1.5">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-display font-medium text-navy mb-6">Recent opportunities</h2>
        {recentOpportunities && recentOpportunities.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-eyebrow text-ink-500 border-b border-line">
                <th className="pb-3 font-semibold">Opportunity</th>
                <th className="pb-3 font-semibold">Institution</th>
                <th className="pb-3 font-semibold">Posted</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOpportunities.map((o) => {
                const inst = Array.isArray(o.institutions) ? o.institutions[0] : o.institutions;
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="py-4 font-medium text-navy">{o.title}</td>
                    <td className="py-4 text-ink-600">{inst?.name ?? "—"}</td>
                    <td className="py-4 text-ink-600">{new Date(o.created_at).toLocaleDateString("en-ZA")}</td>
                    <td className="py-4"><SitheloStatus status={o.status} /></td>
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
