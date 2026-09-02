import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloBadge, SitheloButton } from "@/components/ui/sithelo";

// ====================================================================
// /entrepreneur/opportunities/[id]
//
// DATA SOURCE: public.opportunities (RLS: entrepreneurs read active
// only — a closed/draft/cancelled id here 404s, it isn't hidden by
// this page). match_score/match_reasons come from public.matches,
// the same server-computed rows the dashboard and list page use —
// never recomputed or guessed here (directive §27/§29: "do not
// fabricate why data").
// ====================================================================

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  procurement: "Procurement", funding: "Funding",
  enterprise_development: "Enterprise Development", partnership: "Partnership",
};

const REQUIREMENT_LABELS: Record<string, string> = {
  min_trust_score: "Minimum trust score",
  bbbee_level: "B-BBEE level",
  cidb_grade: "CIDB grade",
  industry: "Industry",
  min_years_trading: "Minimum years trading",
  cipc_required: "CIPC registration required",
  vat_required: "VAT registration required",
  sars_required: "SARS tax clearance required",
};

async function applyAction(formData: FormData) {
  "use server";
  const opportunityId = String(formData.get("opportunity_id"));
  const coverNote = String(formData.get("cover_note") ?? "").slice(0, 2000);

  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: passport } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!passport) return; // no passport yet — UI already gates this, RLS would reject anyway

  // RLS ("applications: entrepreneur insert own") is the actual
  // authority here — it independently re-checks passport ownership,
  // forces status='submitted', and forbids reviewed_by/reviewed_at.
  // The unique(opportunity_id, passport_id) constraint prevents
  // duplicate applications; a 23505 here just means "already applied".
  await supabase.from("applications").insert({
    opportunity_id: opportunityId,
    passport_id: passport.id,
    cover_note: coverNote || null,
  });

  revalidatePath(`/entrepreneur/opportunities/${opportunityId}`);
}

async function withdrawAction(formData: FormData) {
  "use server";
  const applicationId = String(formData.get("application_id"));
  const opportunityId = String(formData.get("opportunity_id"));
  await requireEntrepreneur();
  const supabase = await createClient();

  // Owner-scoped by RLS ("applications: entrepreneur update own
  // limited") — the only transition it permits from this side is
  // -> 'withdrawn'.
  await supabase.from("applications").update({ status: "withdrawn" }).eq("id", applicationId);
  revalidatePath(`/entrepreneur/opportunities/${opportunityId}`);
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("id, title, opportunity_type, category, description, province, municipality, businesses_needed, value_estimate, closing_date, requirements, status, institutions(name)")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  if (!opportunity) notFound();

  const { data: passport } = await supabase
    .from("business_passports")
    .select("id, business_name, industry, overall_verification_status")
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: match } = passport
    ? await supabase
        .from("matches")
        .select("match_score, match_reasons")
        .eq("opportunity_id", id)
        .eq("passport_id", passport.id)
        .maybeSingle()
    : { data: null };

  const { data: application } = passport
    ? await supabase
        .from("applications")
        .select("id, status, cover_note")
        .eq("opportunity_id", id)
        .eq("passport_id", passport.id)
        .maybeSingle()
    : { data: null };

  const inst = Array.isArray(opportunity.institutions) ? opportunity.institutions[0] : opportunity.institutions;
  const reasons: string[] = Array.isArray(match?.match_reasons)
    ? (match!.match_reasons as unknown[]).filter((r): r is string => typeof r === "string")
    : [];
  const requirementEntries = Object.entries((opportunity.requirements as Record<string, unknown>) ?? {});

  const NAV_ITEMS = [
    { label: "Home", href: "/entrepreneur/dashboard" },
    { label: "Business Passport", href: "/entrepreneur/business" },
    { label: "My Journey", href: "/entrepreneur/journey" },
    { label: "Opportunities", href: "/entrepreneur/opportunities", active: true },
  ];

  return (
    <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Entrepreneur">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <SitheloBadge tone="info">{OPPORTUNITY_TYPE_LABELS[opportunity.opportunity_type] ?? opportunity.opportunity_type}</SitheloBadge>
          <h1 className="text-3xl font-display font-bold text-navy tracking-tight mt-3">{opportunity.title}</h1>
          <p className="text-ink-600 mt-1">
            {inst?.name ?? "Institution"} · {opportunity.municipality ?? opportunity.province ?? "South Africa"}
          </p>
        </div>
        {opportunity.value_estimate && (
          <div className="text-2xl font-display font-bold text-cobalt whitespace-nowrap">
            R{(opportunity.value_estimate / 1000000).toFixed(1)}M
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-display font-semibold text-navy mb-3">About this opportunity</h2>
            <p className="text-sm text-ink-600 leading-relaxed">{opportunity.description ?? "No further description provided."}</p>
            <div className="text-xs text-ink-600 mt-4 space-y-1">
              {opportunity.businesses_needed && <div>{opportunity.businesses_needed} businesses needed</div>}
              {opportunity.closing_date && (
                <div>Closing {new Date(opportunity.closing_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div>
              )}
            </div>
          </div>

          {requirementEntries.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-navy mb-3">Requirements</h2>
              <ul className="text-sm text-ink-600 space-y-2">
                {requirementEntries.map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium text-navy">{REQUIREMENT_LABELS[key] ?? key}:</span> {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!passport ? (
            <div className="card text-center py-10">
              <p className="text-sm text-ink-600 mb-4">You need a Business Passport before you can apply.</p>
              <SitheloButton href="/entrepreneur/business/new">Start my Business Passport</SitheloButton>
            </div>
          ) : application ? (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-navy mb-3">Your application</h2>
              <SitheloBadge tone={application.status === "shortlisted" || application.status === "awarded" ? "verified" : "pending"}>
                {application.status.replace(/_/g, " ")}
              </SitheloBadge>
              {application.cover_note && <p className="text-sm text-ink-600 mt-3">{application.cover_note}</p>}
              {application.status === "submitted" && (
                <form action={withdrawAction} className="mt-4">
                  <input type="hidden" name="application_id" value={application.id} />
                  <input type="hidden" name="opportunity_id" value={opportunity.id} />
                  <button type="submit" className="text-sm text-red-600 font-medium">Withdraw application</button>
                </form>
              )}
            </div>
          ) : (
            <div className="card">
              <h2 className="text-lg font-display font-semibold text-navy mb-3">Apply</h2>
              <form action={applyAction} className="space-y-4">
                <input type="hidden" name="opportunity_id" value={opportunity.id} />
                <div>
                  <label className="text-xs text-ink-600 block mb-1">Business profile being submitted</label>
                  <div className="text-sm font-medium text-navy">{passport.business_name}</div>
                </div>
                <div>
                  <label htmlFor="cover_note" className="text-xs text-ink-600 block mb-1">Cover note (optional)</label>
                  <textarea id="cover_note" name="cover_note" rows={4} className="w-full border border-line rounded-lg p-3 text-sm" />
                </div>
                <SitheloButton type="submit">Apply</SitheloButton>
              </form>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {match && (
            <div className="card">
              <div className="text-3xl font-display font-bold text-navy">{Math.round(match.match_score)}%</div>
              <div className="text-sm text-ink-600 mb-4">
                {match.match_score >= 75 ? "You are a strong match" : match.match_score >= 50 ? "You are a good match" : "Partial match"}
              </div>
              {reasons.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">Why</div>
                  <ul className="text-sm text-teal space-y-1.5">
                    {reasons.map((r, i) => <li key={i}>✓ {r}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
          {passport && (
            <div className="card">
              <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">Your Business Passport</div>
              <div className="text-sm text-ink-600">{passport.business_name}</div>
              <SitheloBadge tone={passport.overall_verification_status === "verified" ? "verified" : "pending"}>
                {passport.overall_verification_status === "verified" ? "Verified" : "In progress"}
              </SitheloBadge>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
