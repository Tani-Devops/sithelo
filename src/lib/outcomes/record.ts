// ====================================================================
// Outcomes recorder — the single service-role write path for the event/
// outcome stream (directive §14). Enables future validation of whether
// profile dimensions predict programme completion, opportunity uptake,
// business survival, revenue movement, etc.
//
// CRITICAL: never seed fabricated outcomes. Only record real events.
// ====================================================================

import type { createServiceClient } from "../supabase/service";

export type ServiceClient = ReturnType<typeof createServiceClient>;

export type OutcomeType =
  | "journey_assessed"
  | "programme_completion"
  | "opportunity_application"
  | "opportunity_uptake"
  | "application_status_change"
  | "revenue_movement"
  | "employment_transition"
  | "formalisation"
  | "stage_progression";

export interface OutcomeInput {
  subjectType: "entrepreneur" | "business" | "opportunity" | "programme";
  subjectId: string;
  actorId?: string;
  outcomeType: OutcomeType;
  metadata?: Record<string, unknown>;
}

/**
 * Record a single outcome event. Fire-and-forget semantics are the
 * caller's responsibility; this returns the insert error (if any) so
 * callers can decide whether the failure is ignorable.
 */
export async function recordOutcome(
  service: ServiceClient,
  input: OutcomeInput
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await service.from("outcomes").insert({
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    actor_id: input.actorId ?? null,
    outcome_type: input.outcomeType,
    metadata: input.metadata ?? {},
    occurred_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
