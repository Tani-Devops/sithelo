// ====================================================================
// Opportunity-readiness engine — contextual, never a single global %.
//
// Produces per-class readiness tiers (funding, procurement, incubation,
// accelerator, market, training, investment, corporate, government).
// Each tier is derived from a transparent, deterministic checklist of
// the relevant signals — not a black-box score.
//
// The same module also exposes readinessAgainstOpportunity() in
// src/lib/matching/score.ts (readiness relative to a specific
// opportunity's requirements), because class readiness and
// opportunity-specific readiness are different things (directive §11).
// ====================================================================

import type { AnswerMap } from "../assessment/types";
import type {
  ContextDimensions,
  JourneyStage,
  OpportunityReadiness,
  ReadinessTier,
} from "../classification/types";

function str(answers: AnswerMap, id: string): string | undefined {
  const v = answers[id];
  return typeof v === "string" ? v : undefined;
}

function num(answers: AnswerMap, id: string): number | undefined {
  const v = answers[id];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function confidence(answers: AnswerMap, id: string): number {
  return num(answers, id) ?? 1;
}

function tier(score: number): ReadinessTier {
  if (score >= 0.75) return "strong";
  if (score >= 0.5) return "moderate";
  if (score >= 0.3) return "developing";
  return "early";
}

/** Formalisation state from the assessment. */
export function formalisation(answers: AnswerMap): "informal" | "in_progress" | "formal" {
  const f = str(answers, "e_formalisation");
  if (f === "formal") return "formal";
  if (f === "in_progress") return "in_progress";
  return "informal";
}

/** Whether the business has demonstrated working/repeat demand. */
export function hasRepeatDemand(answers: AnswerMap): boolean {
  const repeat = str(answers, "e_repeat_customers");
  return repeat === "some" || repeat === "mostly";
}

export function hasCustomers(answers: AnswerMap): boolean {
  const c = str(answers, "e_customers");
  return c === "a_few" || c === "steady" || c === "growing";
}

/**
 * Compute per-class opportunity readiness from answers + derived stage
 * and context. Deterministic and auditable.
 */
export function computeOpportunityReadiness(
  answers: AnswerMap,
  _journey: JourneyStage,
  context: ContextDimensions
): OpportunityReadiness {
  const formal = formalisation(answers);
  const formalReady = formal === "formal";
  const repeat = hasRepeatDemand(answers);
  const customers = hasCustomers(answers);
  const consistent = str(answers, "e_revenue_consistency") === "consistent";
  const hasTeam = ["1_4", "5_plus"].includes(str(answers, "e_employees") ?? "");
  const suppliers = str(answers, "e_suppliers") === "established";
  const separatedMoney = str(answers, "f_money_separation") === "fully_separate";

  const records = confidence(answers, "j_record_keeping");
  const documents = confidence(answers, "j_formal_documents");
  const fundingApply = confidence(answers, "j_applying_funding");
  const planning = confidence(answers, "j_planning_growth");
  const digital = confidence(answers, "j_digital_tools");

  const growthIntent = str(answers, "g_growth_ambition");
  const wantsGrowth = growthIntent === "strong_growth" || growthIntent === "scale";

  const digitalAccessOk =
    context.digitalAccessibility === "laptop" || context.digitalAccessibility === "desktop";
  const transportOk = context.transportAccessibility !== "low";
  const timeOk = context.timeCapacity !== "low";

  // ---- Funding readiness: working business + formal + financial basics ----
  const funding =
    (formalReady ? 0.35 : 0) +
    (repeat ? 0.25 : 0) +
    (separatedMoney ? 0.15 : 0) +
    (records >= 3 ? 0.15 : records >= 2 ? 0.08 : 0) +
    (fundingApply >= 3 ? 0.1 : 0);

  // ---- Procurement readiness: formal + delivery capacity + documentation ----
  const procurement =
    (formalReady ? 0.4 : 0) +
    (hasTeam ? 0.15 : 0) +
    (suppliers ? 0.1 : 0) +
    (documents >= 3 ? 0.2 : documents >= 2 ? 0.1 : 0) +
    (records >= 3 ? 0.15 : records >= 2 ? 0.08 : 0);

  // ---- Incubation readiness: commitment + basic digital + time ----
  const incubation =
    (customers ? 0.25 : 0) +
    (wantsGrowth ? 0.3 : 0) +
    (timeOk ? 0.2 : 0) +
    (context.digitalAccessibility !== "none" ? 0.15 : 0) +
    (planning >= 3 ? 0.1 : 0);

  // ---- Accelerator readiness: working business + growth intent + digital ----
  const accelerator =
    (repeat ? 0.3 : 0) +
    (wantsGrowth ? 0.3 : 0) +
    (digitalAccessOk ? 0.2 : context.digitalAccessibility !== "none" ? 0.1 : 0) +
    (planning >= 3 ? 0.2 : 0);

  // ---- Market readiness: offering + customers + transport/logistics ----
  const market =
    (customers ? 0.35 : 0) +
    (repeat ? 0.2 : 0) +
    (transportOk ? 0.25 : 0) +
    (context.digitalAccessibility !== "none" ? 0.2 : 0);

  // ---- Training readiness: low barrier; digital + time are the levers ----
  const training =
    (context.digitalAccessibility !== "none" ? 0.4 : 0) +
    (timeOk ? 0.3 : 0) +
    (digital >= 3 ? 0.3 : digital >= 2 ? 0.15 : 0);

  // ---- Investment readiness: formal + strong growth + records + financial separation ----
  const investment =
    (formalReady ? 0.3 : 0) +
    (wantsGrowth ? 0.25 : 0) +
    (repeat ? 0.15 : 0) +
    (separatedMoney ? 0.15 : 0) +
    (records >= 4 ? 0.15 : records >= 3 ? 0.08 : 0);

  // ---- Corporate readiness: formal + records + procurement-readiness ----
  const corporate =
    (formalReady ? 0.35 : 0) +
    (repeat ? 0.2 : 0) +
    (hasTeam ? 0.15 : 0) +
    (documents >= 3 ? 0.15 : 0) +
    (records >= 3 ? 0.15 : 0);

  // ---- Government readiness: formal + compliance + documentation ----
  const government =
    (formalReady ? 0.45 : 0) +
    (documents >= 3 ? 0.3 : documents >= 2 ? 0.15 : 0) +
    (records >= 3 ? 0.15 : 0) +
    (consistent ? 0.1 : 0);

  return {
    funding: tier(funding),
    procurement: tier(procurement),
    incubation: tier(incubation),
    accelerator: tier(accelerator),
    market: tier(market),
    training: tier(training),
    investment: tier(investment),
    corporate: tier(corporate),
    government: tier(government),
  };
}

/** Human label for a readiness tier. */
export const READINESS_TIER_LABELS: Record<ReadinessTier, string> = {
  early: "Early",
  developing: "Developing",
  moderate: "Moderate",
  strong: "Strong",
};
