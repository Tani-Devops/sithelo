import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloBadge } from "@/components/ui/sithelo";
import { VerificationActions } from "@/components/ui/VerificationActions";

// ====================================================================
// DATA SOURCE: public.verifications where status = 'pending', joined to
// business_passports for context. Admin has full SELECT via the
// "verifications: admin manage" RLS policy — real data, no invented
// fields (risk indicators / "outstanding requirements" from the brief
// are NOT rendered, since nothing in the schema computes those; showing
// them would be exactly the fabricated functionality the brief
// prohibits).
//
// ACTIONS: approve/reject call the real admin-verification edge
// function via VerificationActions (client component) — never a direct
// Supabase update from here. The admin's identity is derived from their
// own session token inside the edge function, never sent as a body
// parameter (see AUDIT.md for why that distinction is load-bearing).
// ====================================================================

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard" },
  { label: "Verification Queue", href: "/admin/verification", active: true },
];

export default async function VerificationQueuePage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("verifications")
    .select("id, verification_type, reference_number, created_at, expiry_date, business_passports(id, business_name, owner_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <PortalShell portalLabel="Admin" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Super Admin">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Verification Queue</h1>
        <p className="text-ink-600 mt-1">Review and decide on pending business verifications.</p>
      </div>

      {error && <p className="text-sm text-ink-600 text-center py-14">We couldn&apos;t load the verification queue right now. Please try again.</p>}

      {!error && (!pending || pending.length === 0) && (
        <SitheloEmptyState title="Nothing pending" body="Every submitted verification has been reviewed. New submissions will appear here." />
      )}

      {!error && pending && pending.length > 0 && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-600 uppercase tracking-wide border-b border-line">
                <th className="pb-3 font-medium">Business</th>
                <th className="pb-3 font-medium">Verification type</th>
                <th className="pb-3 font-medium">Reference</th>
                <th className="pb-3 font-medium">Submitted</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((v) => {
                const bp = Array.isArray(v.business_passports) ? v.business_passports[0] : v.business_passports;
                return (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="py-3 font-medium text-navy">{bp?.business_name ?? "—"}</td>
                    <td className="py-3 text-ink-600 uppercase text-xs font-semibold">{v.verification_type}</td>
                    <td className="py-3 text-ink-600">{v.reference_number ?? "—"}</td>
                    <td className="py-3 text-ink-600">{new Date(v.created_at).toLocaleDateString("en-ZA")}</td>
                    <td className="py-3"><SitheloBadge tone="pending">Pending</SitheloBadge></td>
                    <td className="py-3 text-right"><VerificationActions verificationId={v.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}
