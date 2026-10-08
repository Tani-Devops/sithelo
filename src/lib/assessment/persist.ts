// ====================================================================
// Assessment persistence — the single server-side write path for the
// computed journey profile (assessment_snapshots, journey_profile_history,
// entrepreneur_persona_state). Mirrors src/lib/persona/recompute.ts.
//
// Callers are responsible for their own auth check before calling this —
// it takes a service client and trusts the userId it is given. Never
// expose this to a client component; only Route Handlers that have already
// run requireEntrepreneur() should call it.
// ====================================================================

import { classifyJourney } from "../classification/classify";
import type { JourneyProfile } from "../classification/types";
import type { AnswerMap } from "../assessment/types";
import { recordOutcome } from "../outcomes/record";
import type { createServiceClient } from "../supabase/service";

export type ServiceClient = ReturnType<typeof createServiceClient>;

export type PersistResult =
  | { ok: true; profile: JourneyProfile }
  | { ok: false; status: number; error: string };

function constraintLabels(profile: JourneyProfile): string[] {
  return profile.constraints.map((c) => c.label);
}

/**
 * Classify the given answers and persist the full two-layer profile:
 *   - assessment_snapshots (immutable computed result)
 *   - journey_profile_history (append-only longitudinal record)
 *   - entrepreneur_persona_state (current state for existing pages)
 *   - assessments.status -> completed
 *   - an outcomes row recording the assessment event
 */
export async function completeAndPersistJourney(
  service: ServiceClient,
  userId: string,
  assessmentId: string,
  answers: AnswerMap
): Promise<PersistResult> {
  // 1. Locate the entrepreneur profile (persona_state keys off it).
  const { data: entrepreneurProfile } = await service
    .from("entrepreneur_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!entrepreneurProfile) {
    return { ok: false, status: 409, error: "Complete your Business Passport before taking the journey assessment." };
  }

  // 2. Deterministic classification (no AI, no DB).
  const profile = classifyJourney(answers);

  // 3. Persist the immutable snapshot.
  const { error: snapshotError } = await service
    .from("assessment_snapshots")
    .upsert(
      {
        assessment_id: assessmentId,
        user_id: userId,
        framework_version: profile.frameworkVersion,
        journey_persona: profile.journey,
        context_dimensions: profile.context,
        constraints: profile.constraints,
        access_flags: profile.accessFlags,
        capability_gaps: profile.capabilityGaps,
        risk_capacity: profile.context.riskCapacity,
        growth_aspiration: profile.context.growthAspiration,
        support_preferences: profile.context.supportPreference,
        opportunity_readiness: profile.opportunityReadiness,
        strengths: profile.strengths,
        next_moves: profile.nextMoves,
        recommended_opportunity_characteristics: profile.recommendedOpportunityCharacteristics,
        computed_by: "rules_engine_v2",
        computed_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id" }
    );
  if (snapshotError) {
    return { ok: false, status: 500, error: "Could not save your assessment result." };
  }

  // 4. Append a longitudinal history row (never overwrite).
  const { error: historyError } = await service.from("journey_profile_history").insert({
    user_id: userId,
    assessment_id: assessmentId,
    persona_number: profile.journey.personaNumber,
    persona_name: profile.journey.personaName,
    dimensions: profile.context,
    constraints: profile.constraints,
    opportunity_readiness: profile.opportunityReadiness,
    recorded_at: new Date().toISOString(),
  });
  if (historyError) {
    return { ok: false, status: 500, error: "Could not save your journey history." };
  }

  // 5. Update the current persona state (keeps existing pages working).
  const { error: personaError } = await service
    .from("entrepreneur_persona_state")
    .upsert(
      {
        entrepreneur_profile_id: entrepreneurProfile.id,
        persona_number: profile.journey.personaNumber,
        persona_name: profile.journey.personaName,
        explanation: profile.journey.explanation,
        strengths: profile.strengths,
        constraints: constraintLabels(profile),
        recommended_focus: profile.nextMoves[0] ?? "Keep building your Business Passport.",
        computed_at: new Date().toISOString(),
        computed_by: "rules_engine_v2",
      },
      { onConflict: "entrepreneur_profile_id" }
    );
  if (personaError) {
    return { ok: false, status: 500, error: "Could not update your journey profile." };
  }

  // 6. Mark the assessment complete.
  await service
    .from("assessments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", assessmentId);

  // 7. Record the assessment event for future validation.
  await recordOutcome(service, {
    subjectType: "entrepreneur",
    subjectId: userId,
    actorId: userId,
    outcomeType: "journey_assessed",
    metadata: {
      framework_version: profile.frameworkVersion,
      persona_number: profile.journey.personaNumber,
      persona_name: profile.journey.personaName,
    },
  });

  return { ok: true, profile };
}

export { FRAMEWORK_VERSION } from "../assessment/bank";
