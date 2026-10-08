// ====================================================================
// Classification domain types — the two-layer Sithelo journey profile.
//
// Layer 1: the primary journey persona (1 of 10 stages).
// Layer 2: the multidimensional context (never collapsed into a single
//          "readiness score").
//
// Everything is JSON-safe so it can be persisted to
// assessment_snapshots / journey_profile_history as jsonb.
// ====================================================================

export type Level = "low" | "medium" | "high";

export type EmploymentAttachment =
  | "full_time_employed"
  | "part_time_employed"
  | "self_employed_full"
  | "self_employed_part"
  | "unemployed"
  | "student"
  | "retired";

export type DigitalAccess = "smartphone" | "basic_phone" | "laptop" | "desktop" | "shared" | "none";

export type Motivation =
  | "necessity"
  | "opportunity"
  | "passion"
  | "flexibility"
  | "family"
  | "independence"
  | "mixed";

/** The 10 journey personas (stage labels centralised here per §22). */
export const PERSONA_NAMES: Record<number, string> = {
  1: "Starter",
  2: "Hustler",
  3: "Builder",
  4: "Formaliser",
  5: "Operator",
  6: "Growth Seeker",
  7: "Opportunity Ready",
  8: "Market Ready",
  9: "Scale-Up",
  10: "Strategic Enterprise",
};

export interface JourneyStage {
  personaNumber: number;
  personaName: string;
  /** Human, data-traceable explanation — never fabricated. */
  explanation: string;
  /** The specific signals that produced this stage. */
  stageSignals: string[];
}

export interface ContextDimensions {
  economicDependence: Level;
  householdResponsibility: Level;
  employmentAttachment: EmploymentAttachment;
  timeCapacity: Level;
  careResponsibilities: Level;
  financialResilience: Level;
  riskCapacity: Level;
  digitalAccessibility: DigitalAccess;
  transportAccessibility: Level;
  supportPreference: string[];
  selfEfficacy: SelfEfficacy;
  perceivedControl: Level;
  entrepreneurialIdentity: Level;
  growthAspiration: Level;
  motivation: Motivation;
}

export interface SelfEfficacy {
  /** Overall 1–5, derived from the task-level confidence scales. */
  overall: number;
  /** Task-level confidence, keyed by capability slug. */
  tasks: Record<string, number>;
}

export interface Constraint {
  /** Stable key, e.g. "founder_dependence", "weekday_attendance". */
  key: string;
  label: string;
  /** One of the prioritisation levels. */
  severity: Level;
  /** Human, data-traceable explanation. */
  detail: string;
}

export interface AccessFlag {
  key: string;
  label: string;
  detail: string;
}

export interface CapabilityGap {
  key: string;
  label: string;
  /** 1–5 confidence (lower = larger gap). */
  confidence: number;
}

/** Opportunity-class readiness — contextual, never a single global %. */
export type ReadinessTier = "early" | "developing" | "moderate" | "strong";

export interface OpportunityReadiness {
  funding: ReadinessTier;
  procurement: ReadinessTier;
  incubation: ReadinessTier;
  accelerator: ReadinessTier;
  market: ReadinessTier;
  training: ReadinessTier;
  investment: ReadinessTier;
  corporate: ReadinessTier;
  government: ReadinessTier;
}

export interface JourneyProfile {
  frameworkVersion: string;
  journey: JourneyStage;
  context: ContextDimensions;
  constraints: Constraint[];
  accessFlags: AccessFlag[];
  capabilityGaps: CapabilityGap[];
  strengths: string[];
  opportunityReadiness: OpportunityReadiness;
  /** Characteristics of opportunities that would realistically fit. */
  recommendedOpportunityCharacteristics: string[];
  /** 3–5 concrete next moves, data-traceable. */
  nextMoves: string[];
}
