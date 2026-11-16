import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/ui/PortalShell";
import { Notice } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { isUuid } from "@/lib/documents/rules";
import { formatDate } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireInstitution } from "@/lib/auth/guards";
import { DocumentViewer } from "@/components/ui/DocumentViewer";
import { SitheloRing, SitheloBadge, SitheloButton, SitheloLogo } from "@/components/ui/sithelo";
import { snapshotToJourneyProfile, type AssessmentSnapshotRow } from "@/lib/assessment/read";
import { READINESS_TIER_LABELS } from "@/lib/readiness/readiness";

// ====================================================================
// SECURITY-CRITICAL DATA FLOW — UNCHANGED FROM THE PRIOR PASS.
// This rebrand pass only changes markup/styling below. Every RPC call
// (get_passport_detail, get_passport_activity, get_passport_trust_history)
// and the access_tier branching logic is untouched — the brief for this
// pass is explicit that the frontend must never weaken, bypass, or
// reconstruct the backend authorization model, and this page is exactly
// where that matters most. See prior pass comments in migration history
// (015/019) for the full reasoning; not repeated here to avoid this file
// drifting from being primarily about presentation.
// ====================================================================

interface PassportDetail {
  id: string;
  passport_code: string;
  business_name: string;
  business_type: string | null;
  established_year: number | null;
  industry: string | null;
  province: string | null;
  municipality: string | null;
  business_description: string | null;
  core_services: string | null;
  employees_count: number | null;
  years_trading: number | null;
  website: string | null;
  trust_score: number;
  overall_verification_status: string;
  bbbee_level: number | null;
  is_published: boolean;
  verification_summary: Record<string, boolean>;
  access_tier: "owner_admin" | "authorized_institution" | "discovery";
  annual_turnover?: number | null;
  business_health_score?: number;
  owner_id?: string;
}

interface ActivityEntry {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
}

interface TrustHistoryEntry {
  score: number;
  recorded_at: string;
}

const VERIFICATION_LABELS: Record<string, string> = {
  cipc: "CIPC verified", sars: "Tax compliant", vat: "VAT registered", bank: "Bank verified", bbbee: "B-BBEE verified",
  insurance: "Insurance verified", cidb: "CIDB registered", municipal_supplier: "Municipal supplier",
};

// Shortlisting (institutions only). RLS (018) is the authority: the
// insert policy requires the caller's own institution, created_by =
// auth.uid(), and a PUBLISHED passport; delete is limited to the
// caller's own institution. Ids from the form are never trusted beyond that.
async function toggleShortlistAction(formData: FormData) {
  "use server";
  const { userId, profile } = await requireInstitution();
  const passportId = String(formData.get("passport_id"));
  if (!isUuid(passportId)) redirect("/institution/search");
  if (!profile.institution_id) redirect(`/passport/${passportId}?error=failed`);
  const supabase = await createClient();
  const removing = formData.get("intent") === "remove";

  const { error } = removing
    ? await supabase.from("shortlists").delete()
        .eq("institution_id", profile.institution_id)
        .eq("passport_id", passportId)
    : await supabase.from("shortlists").insert({
        institution_id: profile.institution_id,
        passport_id: passportId,
        created_by: userId,
      });
  revalidatePath(`/passport/${passportId}`);
  revalidatePath("/institution/search");
  redirect(`/passport/${passportId}?${error ? "error=failed" : removing ? "notice=unshortlisted" : "notice=shortlisted"}`);
}

export default async function PassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const { notice, error: errorKey } = await searchParams;
  if (!isUuid(id)) notFound();
  // Defense-in-depth: every other protected page calls a guard explicitly.
  // Layer 1 (middleware) and Layer 3 (get_passport_detail's own auth.uid()
  // tiering) also protect this route, but none of the three is redundant.
  const { userId, profile } = await requireAuth();
  const supabase = await createClient();

  const { data: passport, error } = await supabase.rpc("get_passport_detail", { p_passport_id: id });
  if (error || !passport) notFound();

  const detail = passport as unknown as PassportDetail;
  const showOwnerAdminData = detail.access_tier === "owner_admin";
  const isOwner = detail.owner_id === userId;
  const isInstitutionViewer = profile.role === "institution" && !!profile.institution_id;

  const { data: shortlistRow } = isInstitutionViewer
    ? await supabase
        .from("shortlists")
        .select("id")
        .eq("institution_id", profile.institution_id!)
        .eq("passport_id", id)
        .maybeSingle()
    : { data: null };
  const isShortlisted = !!shortlistRow;

  const { data: activityData } = showOwnerAdminData
    ? await supabase.rpc("get_passport_activity", { p_passport_id: id })
    : { data: null };
  const activity = activityData as unknown as ActivityEntry[] | null;

  const { data: historyData } = showOwnerAdminData
    ? await supabase.rpc("get_passport_trust_history", { p_passport_id: id })
    : { data: null };
  const history = historyData as unknown as TrustHistoryEntry[] | null;

  // The passport OWNER's living journey profile (Tier 0 — owner/admin
  // only, and RLS guarantees an institution viewing this page never
  // receives these rows). Queried by the passport's owner_id, not the
  // viewer's session: previously an admin viewing someone else's passport
  // was shown their OWN journey snapshot pasted onto that passport.
  // owner_id is SELECT-granted to authenticated (021) and RLS limits it to
  // published passports / own row / admin — same visibility as the page.
  const { data: ownerRow } = showOwnerAdminData
    ? await supabase.from("business_passports").select("owner_id").eq("id", id).maybeSingle()
    : { data: null };
  const passportOwnerId = ownerRow?.owner_id;

  const { data: journeySnapshot } = passportOwnerId
    ? await supabase
        .from("assessment_snapshots")
        .select("*")
        .eq("user_id", passportOwnerId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const journey = showOwnerAdminData && journeySnapshot
    ? snapshotToJourneyProfile(journeySnapshot as unknown as AssessmentSnapshotRow)
    : null;

  const isVerified = detail.overall_verification_status === "verified";

  return (
    <PortalShell portal={profile.role} userName={profile.full_name}>
      <Notice notice={notice} error={errorKey} />
      {/* ---- Credential header — the digital business credential itself.
          A ring here is correct (unlike the dashboard, where it became a
          plain number): this page *is* the seal being presented. ---- */}
      <div className="surface-navy relative overflow-hidden mb-10 p-8 md:p-10">
        <div className="relative flex flex-wrap items-start justify-between gap-4 mb-10">
          <SitheloLogo height={28} variant="light" />
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <SitheloButton href="/entrepreneur/business/edit" variant="on-dark-ghost" className="!px-4 !py-2">Edit</SitheloButton>
            )}
            {isInstitutionViewer && (isShortlisted || detail.is_published) && (
              <form action={toggleShortlistAction}>
                <input type="hidden" name="passport_id" value={id} />
                <input type="hidden" name="intent" value={isShortlisted ? "remove" : "add"} />
                <SubmitButton
                  className={`${isShortlisted ? "btn-on-dark-ghost" : "btn-on-dark"} !px-4 !py-2`}
                  pendingLabel={isShortlisted ? "Removing…" : "Adding…"}
                >
                  {isShortlisted ? "Remove from shortlist" : "Add to shortlist"}
                </SubmitButton>
              </form>
            )}
          </div>
        </div>

        <div className="relative grid sm:grid-cols-[auto_1fr] gap-8 items-center">
          <SitheloRing value={detail.trust_score} label={`${detail.trust_score}`} sublabel="Trust Score" size={116} />
          <div>
            <div className="eyebrow-on-dark mb-3">Business Passport</div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-display-lg font-display font-medium text-white">{detail.business_name}</h1>
              {isVerified && <SitheloBadge tone="verified">Verified</SitheloBadge>}
            </div>
            <div className="text-white/55 text-sm">
              {detail.industry ?? "—"} · {detail.municipality ?? "—"}, {detail.province ?? "—"}
              {detail.established_year && ` · Est. ${detail.established_year}`}
            </div>
            <div className="text-white/60 text-xs mt-4 tracking-wide">Passport ID {detail.passport_code}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-x-14 gap-y-10 rule border-t pt-10 mb-10">
        <div>
          <h2 className="eyebrow mb-5">Business Identity</h2>
          <div className="grid sm:grid-cols-2 gap-8 text-sm">
            <div>
              <span className="text-ink-500 block text-xs mb-1.5">Description</span>
              <span className="text-navy leading-relaxed">{detail.business_description ?? "—"}</span>
            </div>
            <div>
              <span className="text-ink-500 block text-xs mb-1.5">Core Services</span>
              <span className="text-navy leading-relaxed">{detail.core_services ?? "—"}</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="eyebrow mb-5">Capabilities</h2>
          <div className="space-y-3 text-sm">
            <Row label="Employees" value={detail.employees_count?.toString() ?? "—"} />
            {detail.annual_turnover !== undefined && (
              <Row label="Annual Turnover" value={detail.annual_turnover ? `R${Number(detail.annual_turnover).toLocaleString()}` : "—"} />
            )}
            <Row label="Years Trading" value={detail.years_trading?.toString() ?? "—"} />
            <Row label="B-BBEE Status" value={detail.bbbee_level ? `Level ${detail.bbbee_level}` : "—"} />
            <Row label="Website" value={detail.website ?? "—"} />
          </div>
        </div>
      </div>

      <div className="rule border-t pt-10 mb-10">
        <h2 className="eyebrow mb-6">Compliance &amp; Verification</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          {Object.entries(VERIFICATION_LABELS).map(([key, label]) => {
            const verified = detail.verification_summary?.[key] === true;
            return (
              <div key={key} className="flex items-center gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${verified ? "bg-verified" : "bg-ink-500/30"}`} />
                <span className={`text-sm ${verified ? "text-navy font-medium" : "text-ink-500"}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {journey && (
        <div className="rule border-t pt-10 mb-10">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="eyebrow">{isOwner ? "Your current entrepreneurial journey" : "Owner's current entrepreneurial journey"}</h2>
            {isOwner && <SitheloButton href="/entrepreneur/journey" variant="ghost" className="!px-4 !py-2">View full journey →</SitheloButton>}
          </div>
          <div className="mb-4">
            <span className="text-2xl font-display font-medium text-navy">
              {String(journey.journey.personaNumber).padStart(2, "0")} — {journey.journey.personaName}
            </span>
          </div>
          <p className="text-sm text-ink-600 max-w-2xl mb-6">{journey.journey.explanation}</p>
          <div className="grid sm:grid-cols-3 gap-x-6 gap-y-4 mb-6">
            <div><span className="text-xs text-ink-500 block mb-1">Work</span><span className="text-sm text-navy">{label(journey.context.employmentAttachment)}</span></div>
            <div><span className="text-xs text-ink-500 block mb-1">Time available</span><span className="text-sm text-navy">{cap(journey.context.timeCapacity)}</span></div>
            <div><span className="text-xs text-ink-500 block mb-1">Risk capacity</span><span className="text-sm text-navy">{cap(journey.context.riskCapacity)}</span></div>
            <div><span className="text-xs text-ink-500 block mb-1">Digital access</span><span className="text-sm text-navy">{cap(journey.context.digitalAccessibility)}</span></div>
            <div><span className="text-xs text-ink-500 block mb-1">Transport</span><span className="text-sm text-navy">{cap(journey.context.transportAccessibility)}</span></div>
            <div><span className="text-xs text-ink-500 block mb-1">Growth aspiration</span><span className="text-sm text-navy">{cap(journey.context.growthAspiration)}</span></div>
          </div>
          {journey.nextMoves.length > 0 && (
            <div className="mb-6">
              <div className="text-xs text-ink-500 mb-2">{isOwner ? "Your next moves" : "Next moves"}</div>
              <ol className="space-y-1.5">
                {journey.nextMoves.map((m, i) => <li key={i} className="text-sm text-ink-600">{i + 1}. {m}</li>)}
              </ol>
            </div>
          )}
          <div>
            <div className="text-xs text-ink-500 mb-2">Opportunity readiness</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {Object.entries(journey.opportunityReadiness).map(([k, v]) => (
                <span key={k} className="text-ink-600 capitalize">{k}: <span className="text-navy font-medium">{READINESS_TIER_LABELS[v as keyof typeof READINESS_TIER_LABELS]}</span></span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-10 rule border-t pt-10">
        <div className="md:col-span-2">
          <h2 className="eyebrow mb-5">Documents</h2>
          {/* Same gate as the "Edit" button above: access_tier
              'owner_admin' covers both the owner and admin (migration
              011/015/019). The upload route re-checks passport
              ownership itself and returns 403 to anyone but the actual
              owner, so this is UX convenience, not the real gate. */}
          <DocumentViewer passportId={id} canUpload={isOwner} />
        </div>

        {showOwnerAdminData && (
          <div>
            <h2 className="eyebrow mb-5">Recent Activity</h2>
            {activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((a) => (
                  <div key={a.id} className="text-sm border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div className="text-navy">{a.description}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{formatDate(a.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-600">No activity yet.</p>
            )}
          </div>
        )}
      </div>

      {showOwnerAdminData && history && history.length > 0 && (
        <div className="rule border-t pt-10 mt-10">
          <h2 className="eyebrow mb-6">Trust Score Over Time</h2>
          <div className="flex items-end gap-2 h-24">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-navy"
                style={{ height: `${h.score}%`, opacity: 0.15 + (h.score / 100) * 0.85 }}
                title={`${h.score}`}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-500 text-center mt-14 pb-6">
        Verification status shown above reflects information currently reviewed through Sithelo, not an automatic check against CIPC, SARS, CIDB, or B-BBEE systems. Sithelo connects institutions with businesses that have submitted this information for review.
      </p>
    </PortalShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-navy text-right">{value}</span>
    </div>
  );
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time_employed: "Employed full-time",
  part_time_employed: "Employed part-time",
  self_employed_full: "Full-time in your business",
  self_employed_part: "Part-time in your business",
  unemployed: "Not currently employed",
  student: "Studying",
  retired: "Retired",
};

function label(employment: string): string {
  return EMPLOYMENT_LABELS[employment] ?? cap(employment);
}
