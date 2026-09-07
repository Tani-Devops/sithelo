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
      <div className="mb-10">
        <div className="eyebrow mb-3">Your Sithelo Journey</div>
        <h1 className="text-display-lg font-display font-medium text-navy leading-tight">
          {String(persona.persona_number).padStart(2, "0")} — {persona.persona_name}
        </h1>
      </div>

      <p className="text-sm text-ink-600 leading-relaxed max-w-2xl rule border-t pt-8 mb-10">{persona.explanation}</p>

      <div className="grid md:grid-cols-2 gap-x-10 gap-y-10 rule border-t pt-10 mb-10">
        <div>
          <div className="eyebrow mb-3">Where you are</div>
          <div className="text-sm text-ink-600">
            {(goals ?? []).length > 0
              ? `Working toward: ${(goals ?? []).map((g) => g.goal_type.replace(/_/g, " ")).join(", ")}.`
              : "Sithelo doesn't have a stated goal on file yet."}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-3">What&apos;s working</div>
          <ul className="text-sm text-verified space-y-1">
            {persona.strengths.map((s: string, i: number) => <li key={i}>✓ {s}</li>)}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">What&apos;s holding you back</div>
          <ul className="text-sm text-ink-600 space-y-1">
            {persona.constraints.map((c: string, i: number) => <li key={i}>⚠ {c}</li>)}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">What you need</div>
          <div className="text-sm text-ink-600">
            {(needs ?? []).length > 0 ? (needs ?? []).map((n) => n.need_type.replace(/_/g, " ")).join(", ") : "Nothing on file yet."}
          </div>
        </div>
      </div>

      <div className="border-l-2 border-blue-600 pl-5 rule border-t pt-10 mb-10">
        <div className="eyebrow mb-2">What Sithelo recommends</div>
        <p className="text-sm text-ink-600 max-w-xl">{persona.recommended_focus}</p>
      </div>

      <div className="rule border-t pt-10">
        <div className="eyebrow mb-5">Your journey</div>
        <div>
          {JOURNEY_STAGES.map((stage, i) => {
            const stageNumber = i + 1;
            const isCurrent = stageNumber === persona.persona_number;
            return (
              <div
                key={stage}
                className={`text-sm py-2.5 border-b border-line last:border-0 ${
                  isCurrent ? "text-navy font-semibold" : "text-ink-600"
                }`}
              >
                {String(stageNumber).padStart(2, "0")} — {stage}
                {isCurrent && <span className="ml-2 text-xs text-blue-600 font-normal">← You are here</span>}
              </div>
            );
          })}
        </div>
      </div>
    </PortalShell>
  );
}
