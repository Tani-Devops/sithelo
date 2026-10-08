import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloButton, SitheloEmptyState } from "@/components/ui/sithelo";
import { snapshotToJourneyProfile, type AssessmentSnapshotRow } from "@/lib/assessment/read";
import { READINESS_TIER_LABELS } from "@/lib/readiness/readiness";
import type { EmploymentAttachment, OpportunityReadiness } from "@/lib/classification/types";

const NAV_ITEMS = [
  { label: "Home", href: "/entrepreneur/dashboard" },
  { label: "Business Passport", href: "/entrepreneur/business" },
  { label: "My Journey", href: "/entrepreneur/journey", active: true },
  { label: "Opportunities", href: "/entrepreneur/opportunities" },
];

const EMPLOYMENT_LABELS: Record<EmploymentAttachment, string> = {
  full_time_employed: "Employed full-time",
  part_time_employed: "Employed part-time",
  self_employed_full: "Full-time in your business",
  self_employed_part: "Part-time in your business",
  unemployed: "Not currently employed",
  student: "Studying",
  retired: "Retired",
};

const READINESS_ORDER: Array<keyof OpportunityReadiness> = [
  "funding", "procurement", "incubation", "accelerator", "market", "training", "investment", "corporate", "government",
];

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function JourneyPage() {
  const { userId, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: entrepreneurProfile } = await supabase
    .from("entrepreneur_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const [{ data: snapshot }, { data: persona }, { data: history }] = entrepreneurProfile
    ? await Promise.all([
        supabase
          .from("assessment_snapshots")
          .select("*")
          .eq("user_id", userId)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("entrepreneur_persona_state")
          .select("persona_number, persona_name, explanation, strengths, constraints, recommended_focus, computed_at")
          .eq("entrepreneur_profile_id", entrepreneurProfile.id)
          .maybeSingle(),
        supabase
          .from("journey_profile_history")
          .select("persona_number, persona_name, recorded_at")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false })
          .limit(10),
      ])
    : [{ data: null }, { data: null }, { data: [] }];

  const full = snapshot ? snapshotToJourneyProfile(snapshot as unknown as AssessmentSnapshotRow) : null;

  if (!full && !persona) {
    return (
      <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Entrepreneur">
        <SitheloEmptyState
          title="Sithelo doesn't have a picture of your journey yet"
          body="Take a short assessment so Sithelo can understand where you are, what you're building, and which opportunities realistically fit."
          actionLabel="Start my journey assessment"
          actionHref="/entrepreneur/assessment"
        />
      </PortalShell>
    );
  }

  const journey = full?.journey ?? {
    personaNumber: persona?.persona_number ?? 1,
    personaName: persona?.persona_name ?? "Starter",
    explanation: persona?.explanation ?? "",
    stageSignals: [],
  };

  return (
    <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Entrepreneur">
      <div className="mb-10">
        <div className="eyebrow mb-3">Your current entrepreneurial journey</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">
          {String(journey.personaNumber).padStart(2, "0")} — {journey.personaName}
        </h1>
      </div>

      <p className="text-sm text-ink-600 leading-relaxed max-w-2xl rule border-t pt-8 mb-10">{journey.explanation}</p>

      {full && (
        <>
          {/* Real-world context */}
          <div className="rule border-t pt-8 mb-10">
            <div className="eyebrow mb-5">Your real-world context</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6">
              <ContextItem label="Work" value={EMPLOYMENT_LABELS[full.context.employmentAttachment]} />
              <ContextItem label="Time available" value={title(full.context.timeCapacity)} />
              <ContextItem label="Household responsibility" value={title(full.context.householdResponsibility)} />
              <ContextItem label="Risk capacity" value={title(full.context.riskCapacity)} />
              <ContextItem label="Digital access" value={title(full.context.digitalAccessibility)} />
              <ContextItem label="Transport" value={title(full.context.transportAccessibility)} />
            </div>
            {full.context.supportPreference.length > 0 && (
              <div className="mt-6">
                <div className="text-xs text-ink-500 mb-1.5">How you like to be supported</div>
                <div className="text-sm text-navy capitalize">
                  {full.context.supportPreference.map((p) => p.replace(/_/g, " ")).join(", ")}
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-x-10 gap-y-10 rule border-t pt-10 mb-10">
            <div>
              <div className="eyebrow mb-3">What&apos;s working</div>
              <ul className="text-sm text-verified space-y-1.5">
                {full.strengths.map((s, i) => <li key={i}>✓ {s}</li>)}
              </ul>
            </div>
            <div>
              <div className="eyebrow mb-3">What&apos;s holding you back</div>
              <ul className="text-sm text-ink-600 space-y-1.5">
                {full.constraints.length > 0
                  ? full.constraints.map((c, i) => (
                      <li key={i}>
                        <span className="font-medium text-navy">{c.label}:</span> {c.detail}
                      </li>
                    ))
                  : <li>No major blockers identified from what you&apos;ve told us.</li>}
              </ul>
            </div>
          </div>

          {/* Opportunity readiness */}
          <div className="rule border-t pt-8 mb-10">
            <div className="eyebrow mb-5">Opportunity readiness</div>
            <p className="text-sm text-ink-600 mb-5 max-w-2xl">
              Readiness is different for each kind of opportunity — it&apos;s not one score. These reflect your current journey profile.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              {READINESS_ORDER.map((key) => (
                <div key={key} className="flex items-baseline justify-between border-b border-line pb-2">
                  <span className="text-sm text-ink-600 capitalize">{key}</span>
                  <span className="text-sm font-medium text-navy">{READINESS_TIER_LABELS[full.opportunityReadiness[key]]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next moves */}
          <div className="rule border-t pt-8 mb-10">
            <div className="eyebrow mb-5">Your next moves</div>
            <ol className="space-y-3">
              {full.nextMoves.map((move, i) => (
                <li key={i} className="text-sm text-ink-600 flex gap-3">
                  <span className="font-display font-medium text-navy shrink-0">{i + 1}.</span>
                  <span>{move}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* Journey history */}
      {history && history.length > 1 && (
        <div className="rule border-t pt-8 mb-10">
          <div className="eyebrow mb-5">Your journey over time</div>
          <div>
            {history.map((h, i) => (
              <div key={i} className="text-sm py-2.5 border-b border-line last:border-0 flex justify-between">
                <span className="text-navy">{h.persona_name}</span>
                <span className="text-ink-500">{new Date(h.recorded_at).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <SitheloButton href="/entrepreneur/opportunities">View opportunities that fit</SitheloButton>
        <SitheloButton href="/entrepreneur/assessment" variant="ghost">Retake my journey assessment</SitheloButton>
      </div>
    </PortalShell>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-500 mb-1">{label}</div>
      <div className="text-base font-display font-medium text-navy">{value}</div>
    </div>
  );
}
