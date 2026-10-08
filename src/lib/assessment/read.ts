// ====================================================================
// Server-side read helpers for the persisted journey profile.
// Reconstructs a typed JourneyProfile from an assessment_snapshots row.
// ====================================================================

import type { JourneyProfile } from "../classification/types";

export interface AssessmentSnapshotRow {
  framework_version: string;
  journey_persona: JourneyProfile["journey"];
  context_dimensions: JourneyProfile["context"];
  constraints: JourneyProfile["constraints"];
  access_flags: JourneyProfile["accessFlags"];
  capability_gaps: JourneyProfile["capabilityGaps"];
  risk_capacity: string | null;
  growth_aspiration: string | null;
  support_preferences: string[];
  opportunity_readiness: JourneyProfile["opportunityReadiness"];
  strengths: string[];
  next_moves: string[];
  recommended_opportunity_characteristics: string[];
  computed_by: string;
  computed_at: string;
}

/** Reconstruct a JourneyProfile from a persisted snapshot row. */
export function snapshotToJourneyProfile(row: AssessmentSnapshotRow): JourneyProfile {
  return {
    frameworkVersion: row.framework_version,
    journey: row.journey_persona,
    context: row.context_dimensions,
    constraints: row.constraints,
    accessFlags: row.access_flags,
    capabilityGaps: row.capability_gaps,
    strengths: row.strengths,
    opportunityReadiness: row.opportunity_readiness,
    recommendedOpportunityCharacteristics: row.recommended_opportunity_characteristics,
    nextMoves: row.next_moves,
  };
}
