import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireInstitution } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState, SitheloStatus, SitheloButton } from "@/components/ui/sithelo";

// ====================================================================
// /institution/applications
//
// Completes the institution side of the application lifecycle that
// previously only existed for entrepreneurs (see
// src/app/entrepreneur/opportunities/[id]/page.tsx for the apply/
// withdraw half of this same flow).
//
// SECURITY — ownership is derived server-side, never trusted from the
// client:
//   - The list query filters applications by opportunity_id IN (this
//     institution's own opportunity ids), and that set is itself derived
//     from profile.institution_id off the authenticated session
//     (requireInstitution()), never from anything the client supplies.
//   - The actual authority is RLS, not this filter: "applications:
//     institution read own opportunity" (002/019) already restricts
//     institutions to applications on their own opportunities, so even
//     if this query were malformed it could not leak another
//     institution's applicants.
//   - Status transitions go through updateStatusAction below, which
//     re-derives institution_id from the session on every call and lets
//     RLS + enforce_application_integrity (023) reject anything outside
//     the allowed institution-side transitions (-> under_review,
//     shortlisted, rejected, awarded). No status value from the client
//     is trusted beyond "this is what the button asked for" — the
//     database is what actually decides whether it's allowed.
//   - Full business detail (contact info, documents) is never queried
//     directly here. Each row links to /passport/[id], which calls
//     get_passport_detail()/list_passport_documents() — those already
//     grant "authorized_institution" tier access the moment
//     has_passport_relationship() is true, which an application itself
//     establishes (015). Nothing new needed for that; it's reused as-is.
// ====================================================================

const NAV_ITEMS = [
  { label: "Home", href: "/institution/dashboard" },
  { label: "Discover Businesses", href: "/institution/search" },
  { label: "Opportunities", href: "/institution/opportunities" },
  { label: "Applications", href: "/institution/applications", active: true },
];

const STATUS_FILTERS = ["all", "submitted", "under_review", "shortlisted", "awarded", "rejected", "withdrawn"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  submitted: ["under_review", "shortlisted", "rejected"],
  under_review: ["shortlisted", "rejected"],
  shortlisted: ["awarded", "rejected"],
};

async function updateStatusAction(formData: FormData) {
  "use server";
  const applicationId = String(formData.get("application_id"));
  const nextStatus = String(formData.get("next_status"));
  const opportunityId = String(formData.get("opportunity_id") ?? "");

  const { profile } = await requireInstitution();
  const supabase = await createClient();

  // Re-derive ownership rather than trust the hidden opportunity_id
  // field for anything beyond revalidation — the actual write below is
  // scoped by applications.id and enforced by RLS, which itself joins
  // back to opportunities.institution_id = the caller's own. A forged
  // application_id belonging to another institution's opportunity is
  // rejected by RLS, not by this check.
  if (!profile.institution_id) return;

  await supabase.from("applications").update({ status: nextStatus }).eq("id", applicationId);

  revalidatePath("/institution/applications");
  if (opportunityId) revalidatePath(`/institution/opportunities/${opportunityId}`);
}

export default async function InstitutionApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; opportunity?: string }>;
}) {
  const { profile } = await requireInstitution();
  const supabase = await createClient();
  const params = await searchParams;
  const statusFilter: StatusFilter = STATUS_FILTERS.includes(params.status as StatusFilter)
    ? (params.status as StatusFilter)
    : "all";

  const { data: myOpportunities } = await supabase
    .from("opportunities")
    .select("id, title")
    .eq("institution_id", profile.institution_id ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false });

  const opportunityIds = (myOpportunities ?? []).map((o) => o.id);

  let query = supabase
    .from("applications")
    .select("id, status, cover_note, created_at, reviewed_at, opportunity_id, passport_id, opportunities(title)")
    .in("opportunity_id", opportunityIds.length ? opportunityIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (params.opportunity) query = query.eq("opportunity_id", params.opportunity);

  const { data: applications, error } = await query;

  const passportIds = [...new Set((applications ?? []).map((a) => a.passport_id))];
  const { data: businesses } = passportIds.length
    ? await supabase
        .from("institution_business_directory")
        .select("id, business_name, trust_score, overall_verification_status, bbbee_level")
        .in("id", passportIds)
    : { data: [] };
  const businessById = new Map((businesses ?? []).map((b) => [b.id, b]));

  function filterHref(status: StatusFilter) {
    const qs = new URLSearchParams();
    if (status !== "all") qs.set("status", status);
    if (params.opportunity) qs.set("opportunity", params.opportunity);
    const s = qs.toString();
    return s ? `/institution/applications?${s}` : "/institution/applications";
  }

  return (
    <PortalShell portalLabel="Institution" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Procurement Officer">
      <div className="mb-8 rule border-b pb-8">
        <div className="eyebrow mb-3">Applications</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">
          Applications to your opportunities.
        </h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={filterHref(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? "bg-navy text-white border-navy" : "border-line text-ink-600 hover:border-navy/40"
            }`}
          >
            {s === "all" ? "All" : s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {error && (
        <div className="text-center py-14">
          <p className="text-sm text-ink-600">We couldn&apos;t load applications right now. Please try again.</p>
        </div>
      )}

      {!error && (!applications || applications.length === 0) && (
        <SitheloEmptyState
          title="No applications yet"
          body="Once entrepreneurs apply to your opportunities, their applications will appear here for review."
        />
      )}

      {!error && applications && applications.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-eyebrow text-ink-500 border-b border-line">
                <th className="pb-3 font-semibold">Business</th>
                <th className="pb-3 font-semibold">Opportunity</th>
                <th className="pb-3 font-semibold">Trust score</th>
                <th className="pb-3 font-semibold">Applied</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const business = businessById.get(app.passport_id);
                const oppTitle = (app.opportunities as unknown as { title: string } | null)?.title ?? "—";
                const transitions = ALLOWED_TRANSITIONS[app.status] ?? [];
                return (
                  <tr key={app.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-4 font-medium text-navy">
                      <Link href={`/passport/${app.passport_id}`} className="hover:text-blue-600">
                        {business?.business_name ?? "View Passport"}
                      </Link>
                      {business?.bbbee_level != null && (
                        <div className="text-xs text-ink-500 mt-0.5">B-BBEE Level {business.bbbee_level}</div>
                      )}
                    </td>
                    <td className="py-4 text-ink-600">{oppTitle}</td>
                    <td className="py-4 text-ink-600">{business?.trust_score ?? "—"}</td>
                    <td className="py-4 text-ink-600">{new Date(app.created_at).toLocaleDateString("en-ZA")}</td>
                    <td className="py-4"><SitheloStatus status={app.status} /></td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <SitheloButton variant="ghost" href={`/passport/${app.passport_id}`} className="text-xs px-3 py-1.5">
                          View Passport
                        </SitheloButton>
                        {transitions.map((next) => (
                          <form key={next} action={updateStatusAction}>
                            <input type="hidden" name="application_id" value={app.id} />
                            <input type="hidden" name="next_status" value={next} />
                            <input type="hidden" name="opportunity_id" value={app.opportunity_id} />
                            <button
                              type="submit"
                              className="text-xs px-3 py-1.5 rounded-full border border-line text-ink-600 hover:border-navy/40 hover:text-navy transition-colors capitalize"
                            >
                              {next.replace(/_/g, " ")}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
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
