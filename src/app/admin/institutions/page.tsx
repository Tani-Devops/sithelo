import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloBadge } from "@/components/ui/sithelo";

// ====================================================================
// /admin/institutions
//
// Institution approval queue (migration 028: institutions.approval_status).
// An institution-role account can self-register and complete onboarding
// (complete_institution_onboarding, 027) and lands here as `pending` --
// it cannot publish an active opportunity or otherwise act as a trusted
// Sithelo institution until an admin makes a decision here.
//
// The decision itself goes through admin_review_institution() (028), a
// SECURITY DEFINER function that re-checks is_admin() server-side and is
// the ONLY path that can move approval_status out of pending -- this
// page's form action re-derives the admin's identity from their own
// session (requireAdmin()) and never trusts a client-supplied actor id,
// same pattern as updateStatusAction on /institution/applications.
// ====================================================================

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard" },
  { label: "Verification Queue", href: "/admin/verification" },
  { label: "Institution Approvals", href: "/admin/institutions", active: true },
];

async function reviewInstitutionAction(formData: FormData) {
  "use server";
  const institutionId = String(formData.get("institution_id"));
  const decision = String(formData.get("decision"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await requireAdmin();
  const supabase = await createClient();

  if (decision !== "approve" && decision !== "reject") return;

  await supabase.rpc("admin_review_institution", {
    p_institution_id: institutionId,
    p_decision: decision,
    p_notes: notes,
  });

  revalidatePath("/admin/institutions");
}

export default async function InstitutionApprovalsPage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("institutions")
    .select("id, name, institution_type, province, municipality, website, primary_contact_name, primary_contact_email, primary_contact_phone, description, focus_area, created_at")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });

  return (
    <PortalShell portalLabel="Admin" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Super Admin">
      <div className="mb-10 rule border-b pb-8">
        <div className="eyebrow mb-3">Admin</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">Institution Approvals</h1>
        <p className="text-ink-600 mt-2">Review new institutions before they can publish opportunities.</p>
      </div>

      {error && <p className="text-sm text-ink-600 text-center py-14">We couldn&apos;t load the approval queue right now. Please try again.</p>}

      {!error && (!pending || pending.length === 0) && (
        <SitheloEmptyState title="Nothing pending" body="Every registered institution has been reviewed. New registrations will appear here." />
      )}

      {!error && pending && pending.length > 0 && (
        <div className="space-y-6">
          {pending.map((inst) => (
            <div key={inst.id} className="card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-display text-lg font-medium text-navy">{inst.name}</h2>
                    <SitheloBadge tone="pending">Pending</SitheloBadge>
                  </div>
                  <p className="text-xs text-ink-500 uppercase tracking-wide">{inst.institution_type ?? "Type not specified"}</p>
                </div>
                <p className="text-xs text-ink-500">Registered {new Date(inst.created_at).toLocaleDateString("en-ZA")}</p>
              </div>

              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-6 text-sm">
                <div>
                  <dt className="text-xs text-ink-500">Location</dt>
                  <dd className="text-ink-700">{[inst.municipality, inst.province].filter(Boolean).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Website</dt>
                  <dd className="text-ink-700">{inst.website || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Primary contact</dt>
                  <dd className="text-ink-700">{inst.primary_contact_name || "—"} · {inst.primary_contact_email || "—"} {inst.primary_contact_phone ? `· ${inst.primary_contact_phone}` : ""}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Focus area</dt>
                  <dd className="text-ink-700">{inst.focus_area || "—"}</dd>
                </div>
                {inst.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-ink-500">Description</dt>
                    <dd className="text-ink-700">{inst.description}</dd>
                  </div>
                )}
              </dl>

              <form action={reviewInstitutionAction} className="flex flex-wrap items-center gap-3 mt-6 pt-6 rule border-t">
                <input type="hidden" name="institution_id" value={inst.id} />
                <input
                  type="text"
                  name="notes"
                  placeholder="Notes (shown to the institution if rejected)"
                  className="input flex-1 min-w-[200px] !py-1.5 !text-xs"
                />
                <button
                  type="submit"
                  name="decision"
                  value="reject"
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Reject
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className="btn-primary !py-1.5 !px-3 !text-xs"
                >
                  Approve
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
