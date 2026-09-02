import { createClient } from "@/lib/supabase/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { PortalShell } from "@/components/ui/PortalShell";
import { SitheloEmptyState } from "@/components/ui/sithelo";

// ====================================================================
// /entrepreneur/journey
//
// Reads the persisted public.entrepreneur_persona_state — never
// recomputes inline. Recomputation happens via POST /api/persona/recompute
// (the only write path, service-role-only), triggered after onboarding
// or whenever underlying data changes. This page just reads and
// explains the most recent computed state (directive §25).
// ====================================================================

const JOURNEY_STAGES = [
  "Starter", "Hustler", "Builder", "Formaliser", "Operator",
  "Growth Seeker", "Opportunity Ready", "Market Ready", "Scaler", "Economic Builder",
];

const NAV_ITEMS = [
  { label: "Home", href: "/entrepreneur/dashboard" },
  { label: "Business Passport", href: "/entrepreneur/business" },
  { label: "My Journey", href: "/entrepreneur/journey", active: true },
  { label: "Opportunities", href: "/entrepreneur/opportunities" },
];

export default async function JourneyPage() {
  const { userId, profile } = await requireEntrepreneur();
  const supabase = await createClient();

  const { data: entrepreneurProfile } = await supabase
    .from("entrepreneur_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: persona } = entrepreneurProfile
    ? await supabase
        .from("entrepreneur_persona_state")
        .select("persona_number, persona_name, explanation, strengths, constraints, recommended_focus, computed_at")
        .eq("entrepreneur_profile_id", entrepreneurProfile.id)
        .maybeSingle()
    : { data: null };

  const { data: needs } = entrepreneurProfile
    ? await supabase.from("entrepreneur_needs").select("need_type").eq("entrepreneur_profile_id", entrepreneurProfile.id)
    : { data: [] };

  const { data: goals } = entrepreneurProfile
    ? await supabase.from("entrepreneur_goals").select("goal_type").eq("entrepreneur_profile_id", entrepreneurProfile.id)
    : { data: [] };

  if (!persona) {
    return (
      <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Entrepreneur">
        <SitheloEmptyState
          title="Sithelo doesn't have a picture of your journey yet"
          body="Complete onboarding and your Business Passport so Sithelo can work out where you are and what's next."
          actionLabel="Continue my Business Passport"
          actionHref="/entrepreneur/business"
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell portalLabel="Entrepreneur" navItems={NAV_ITEMS} userName={profile.full_name} userRole="Entrepreneur">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-navy tracking-tight">Your Sithelo Journey</h1>
        <p className="text-ink-600 mt-1">
          {String(persona.persona_number).padStart(2, "0")}: {persona.persona_name}
        </p>
      </div>

      <div className="card mb-6">
        <p className="text-sm text-ink-600 leading-relaxed">{persona.explanation}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">Where you are</div>
          <div className="text-sm text-ink-600">
            {(goals ?? []).length > 0
              ? `Working toward: ${(goals ?? []).map((g) => g.goal_type.replace(/_/g, " ")).join(", ")}.`
              : "Sithelo doesn't have a stated goal on file yet."}
          </div>
        </div>
        <div className="card">
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">What&apos;s working</div>
          <ul className="text-sm text-teal space-y-1">
            {persona.strengths.map((s: string, i: number) => <li key={i}>✓ {s}</li>)}
          </ul>
        </div>
        <div className="card">
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">What&apos;s holding you back</div>
          <ul className="text-sm text-ink-600 space-y-1">
            {persona.constraints.map((c: string, i: number) => <li key={i}>⚠ {c}</li>)}
          </ul>
        </div>
        <div className="card">
          <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-3">What you need</div>
          <div className="text-sm text-ink-600">
            {(needs ?? []).length > 0 ? (needs ?? []).map((n) => n.need_type.replace(/_/g, " ")).join(", ") : "Nothing on file yet."}
          </div>
        </div>
      </div>

      <div className="card mb-8 border-cobalt/30">
        <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-2">What Sithelo recommends</div>
        <p className="text-sm text-ink-600">{persona.recommended_focus}</p>
      </div>

      <div className="card">
        <div className="text-xs font-semibold text-navy uppercase tracking-wide mb-4">Your journey</div>
        <div className="space-y-2">
          {JOURNEY_STAGES.map((stage, i) => {
            const stageNumber = i + 1;
            const isCurrent = stageNumber === persona.persona_number;
            return (
              <div
                key={stage}
                className={`text-sm py-1.5 px-3 rounded-lg ${
                  isCurrent ? "bg-cobalt text-white font-semibold" : "text-ink-600"
                }`}
              >
                {String(stageNumber).padStart(2, "0")}: {stage}
                {isCurrent && <span className="ml-2 text-xs opacity-80">← You are here</span>}
              </div>
            );
          })}
        </div>
      </div>
    </PortalShell>
  );
}
