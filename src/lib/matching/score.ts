// ====================================================================
// Sithelo matching engine — deterministic, explainable.
//
// Replaces the old mental model (Entrepreneur -> Programme) with:
//   PERSON + VENTURE + LIFE CONTEXT + CAPABILITY + CONSTRAINTS + ACCESS
//   + ASPIRATION  MATCHED AGAINST  OPPORTUNITY REQUIREMENTS.
//
// Five outputs are computed SEPARATELY (never conflated):
//   1. eligibility   — hard, gate-tested (legal/administrative).
//   2. businessFit   — stage + sector + capability alignment.
//   3. practicalFit  — time, transport, device, schedule, contribution.
//   4. readiness     — relative to THIS opportunity's requirements.
//   5. friction      — the explicit practical mismatches (not blockers).
//
// Eligibility failure is shown with a reason; practical friction is shown
// WITH the opportunity and an explanation (the entrepreneur keeps agency —
// directive §8). Pure and unit-testable.
// ====================================================================

import type { AnswerMap } from "../assessment/types";
import type { JourneyProfile } from "../classification/types";
import { formalisation } from "../readiness/readiness";

export type RequirementCategory = "eligibility" | "practical_fit" | "readiness";

export interface Requirement {
  key: string;
  value: string | number | boolean;
  category: RequirementCategory;
  label?: string;
}

export type EligibilityStatus = "eligible" | "ineligible" | "unverified";

export interface FrictionItem {
  key: string;
  label: string;
  detail: string;
}

export interface MatchResult {
  matchScore: number; // 0-100, only meaningful when eligibility !== 'ineligible'
  eligibility: EligibilityStatus;
  eligibilityReasons: string[]; // why ineligible / what's unverified
  businessFit: number; // 0-100
  practicalFit: number; // 0-100
  readiness: number; // 0-100
  friction: FrictionItem[];
  reasons: string[]; // positive reasons (strong alignment)
  explanation: string; // human, data-traceable summary
}

/** Business facts assembled from the passport + verification tables. */
export interface BusinessFacts {
  formalised: boolean;
  revenueMonthly: number | null; // estimated monthly revenue (midpoint) or null
  yearsTrading: number | null;
  employees: number | null;
  trustScore: number | null;
  bbbeeLevel: number | null; // lower is better (Level 1 > Level 8)
  verifiedCompliance: string[]; // e.g. ['cipc','sars','vat','bbbee','cidb','bank','municipal_supplier','insurance']
  industry: string | null;
}

export interface MatchableEntrepreneur {
  profile: JourneyProfile;
  answers: AnswerMap;
  business: BusinessFacts;
}

// --------------------------------------------------------------------
// Business facts → threshold helpers
// --------------------------------------------------------------------

function numReq(r: Requirement): number | undefined {
  return typeof r.value === "number" ? r.value : undefined;
}

function boolReq(r: Requirement): boolean {
  return r.value === true;
}

function strReq(r: Requirement): string | undefined {
  return typeof r.value === "string" ? r.value : undefined;
}

// --------------------------------------------------------------------
// Eligibility
// --------------------------------------------------------------------

function evaluateEligibility(
  requirements: Requirement[],
  ent: MatchableEntrepreneur
): { status: EligibilityStatus; reasons: string[] } {
  const eligibility = requirements.filter((r) => r.category === "eligibility");
  const reasons: string[] = [];
  let ineligible = false;
  let unverified = false;

  const has = (t: string) => ent.business.verifiedCompliance.includes(t);

  for (const r of eligibility) {
    switch (r.key) {
      case "registration_required":
      case "cipc_required": {
        if (boolReq(r) && !ent.business.formalised) {
          ineligible = true;
          reasons.push("Requires formal registration (CIPC), which is not confirmed on your profile.");
        }
        break;
      }
      case "vat_required": {
        if (boolReq(r) && !has("vat")) {
          // VAT is a hard compliance gate; if not verified, treat as unverified rather than ineligible
          // only when the passport simply hasn't been reviewed yet.
          unverified = true;
          reasons.push("Requires VAT registration, which is not yet confirmed on your profile.");
        }
        break;
      }
      case "sars_required": {
        if (boolReq(r) && !has("sars")) {
          unverified = true;
          reasons.push("Requires SARS tax clearance, which is not yet confirmed on your profile.");
        }
        break;
      }
      case "bbbee_level": {
        // Level 1 is best; lower number is better. The requirement's numeric
        // value is the WORST acceptable level.
        const required = numReq(r);
        const level = ent.business.bbbeeLevel;
        if (required !== undefined && level !== null && level > required) {
          ineligible = true;
          reasons.push(`Requires B-BBEE Level ${required} or better.`);
        } else if (required !== undefined && level === null) {
          unverified = true;
          reasons.push(`Requires B-BBEE Level ${required} or better, which is not on your profile yet.`);
        }
        break;
      }
      case "min_years_trading": {
        const required = numReq(r);
        const years = ent.business.yearsTrading;
        if (required !== undefined && years !== null && years < required) {
          ineligible = true;
          reasons.push(`Requires at least ${required} years trading.`);
        } else if (required !== undefined && years === null) {
          unverified = true;
          reasons.push(`Requires at least ${required} years trading — not yet recorded.`);
        }
        break;
      }
      case "min_trust_score": {
        const required = numReq(r);
        const trust = ent.business.trustScore;
        if (required !== undefined && trust !== null && trust < required) {
          ineligible = true;
          reasons.push(`Requires a minimum trust score of ${required}.`);
        }
        break;
      }
      case "sector": {
        const sector = strReq(r);
        if (sector && ent.business.industry && sector.toLowerCase() !== ent.business.industry.toLowerCase()) {
          ineligible = true;
          reasons.push(`This opportunity is for the ${sector} sector.`);
        }
        break;
      }
      default:
        // Unknown eligibility key — ignore rather than fabricate a judgement.
        break;
    }
  }

  if (ineligible) return { status: "ineligible", reasons };
  if (unverified) return { status: "unverified", reasons };
  return { status: "eligible", reasons };
}

// --------------------------------------------------------------------
// Business fit
// --------------------------------------------------------------------

function evaluateBusinessFit(
  requirements: Requirement[],
  ent: MatchableEntrepreneur
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  // Stage suitability (readiness category carries stage hints).
  const stageMin = requirements.find((r) => r.key === "stage_min");
  if (stageMin) {
    const min = numReq(stageMin);
    const persona = ent.profile.journey.personaNumber;
    if (min !== undefined && persona >= min) {
      score += 20;
      reasons.push(`Your current stage (${ent.profile.journey.personaName}) is a fit.`);
    } else if (min !== undefined && persona < min) {
      score -= 15;
    }
  }

  // Sector.
  const sector = requirements.find((r) => r.category === "eligibility" && r.key === "sector");
  if (sector && strReq(sector) && ent.business.industry && strReq(sector)!.toLowerCase() === ent.business.industry.toLowerCase()) {
    score += 15;
    reasons.push(`Sector aligned (${ent.business.industry}).`);
  }

  // Growth objective alignment (from readiness requirement).
  const growthFit = requirements.find((r) => r.key === "growth_focus");
  if (growthFit && strReq(growthFit) === "growth" && ent.profile.context.growthAspiration === "high") {
    score += 10;
    reasons.push("Matches your growth objective.");
  }

  // Trust contribution.
  if (ent.business.trustScore !== null) {
    score += Math.round((ent.business.trustScore / 100) * 15);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// --------------------------------------------------------------------
// Practical fit + friction
// --------------------------------------------------------------------

function evaluatePracticalFit(
  requirements: Requirement[],
  ent: MatchableEntrepreneur
): { score: number; friction: FrictionItem[] } {
  const friction: FrictionItem[] = [];
  let score = 100;

  const ctx = ent.profile.context;

  const schedule = requirements.find((r) => r.key === "schedule");
  if (schedule) {
    const value = strReq(schedule);
    if (value === "weekday" && ctx.employmentAttachment === "full_time_employed") {
      score -= 30;
      friction.push({
        key: "schedule",
        label: "Weekday schedule",
        detail: "Requires weekday attendance while you're in full-time employment.",
      });
    } else if (value === "weekday" && ctx.timeCapacity === "low") {
      score -= 15;
      friction.push({ key: "schedule", label: "Weekday schedule", detail: "Weekday attendance may be difficult with your current commitments." });
    }
  }

  const delivery = requirements.find((r) => r.key === "delivery");
  if (delivery && strReq(delivery) === "physical") {
    if (ctx.transportAccessibility === "low") {
      score -= 20;
      friction.push({
        key: "travel",
        label: "In-person attendance",
        detail: "Requires physical attendance and your transport access is limited.",
      });
    }
  }

  const travelRequired = requirements.find((r) => r.key === "travel_required");
  if (travelRequired && boolReq(travelRequired) && ctx.transportAccessibility === "low") {
    score -= 15;
    friction.push({ key: "travel", label: "Travel required", detail: "Travel is required, which is a barrier for you right now." });
  }

  const device = requirements.find((r) => r.key === "device_required");
  if (device && strReq(device) === "laptop") {
    if (ctx.digitalAccessibility === "smartphone" || ctx.digitalAccessibility === "basic_phone" || ctx.digitalAccessibility === "shared" || ctx.digitalAccessibility === "none") {
      score -= 20;
      friction.push({
        key: "device",
        label: "Laptop required",
        detail: "Requires a laptop; you indicated primarily phone-based access.",
      });
    }
  }

  const contribution = requirements.find((r) => r.key === "participant_contribution");
  const contributionValue = contribution ? numReq(contribution) : undefined;
  if (contributionValue !== undefined && contributionValue > 0 && ctx.riskCapacity === "low") {
    score -= 10;
    friction.push({
      key: "contribution",
      label: "Upfront contribution",
      detail: `Has a contribution of R${contributionValue.toLocaleString()}, which may be a stretch given current risk capacity.`,
    });
  }

  const hours = requirements.find((r) => r.key === "hours_per_week");
  const hoursValue = hours ? numReq(hours) : undefined;
  if (hoursValue !== undefined && hoursValue >= 15 && ctx.timeCapacity === "low") {
    score -= 15;
    friction.push({
      key: "hours",
      label: "Time commitment",
      detail: `Requires about ${hoursValue} hours per week, more than your current availability suggests.`,
    });
  }

  return { score: Math.max(0, Math.min(100, score)), friction };
}

// --------------------------------------------------------------------
// Readiness (relative to THIS opportunity)
// --------------------------------------------------------------------

function evaluateReadiness(
  requirements: Requirement[],
  ent: MatchableEntrepreneur,
  formalState: "informal" | "in_progress" | "formal"
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50;

  const readiness = ent.profile.opportunityReadiness;

  const needsFunding = requirements.some((r) => r.key === "funding_required" && boolReq(r));
  if (needsFunding) {
    const tier = readiness.funding;
    const points = { early: 0, developing: 15, moderate: 30, strong: 45 } as const;
    score += points[tier];
    if (tier === "strong" || tier === "moderate") reasons.push("Your funding readiness is a good match.");
  }

  const needsProcurement = requirements.some((r) => r.key === "procurement_required" && boolReq(r));
  if (needsProcurement) {
    const tier = readiness.procurement;
    const points = { early: 0, developing: 15, moderate: 30, strong: 45 } as const;
    score += points[tier];
    if (tier === "strong" || tier === "moderate") reasons.push("Your procurement readiness is a good match.");
  }

  const needsCapacity = requirements.some((r) => r.key === "capacity_required" && boolReq(r));
  if (needsCapacity && ent.business.employees !== null && ent.business.employees >= 1) {
    score += 15;
    reasons.push("You have the delivery capacity this requires.");
  } else if (needsCapacity) {
    score -= 10;
  }

  const needsStaffing = requirements.some((r) => r.key === "staffing_required" && boolReq(r));
  if (needsStaffing && ent.business.employees !== null && ent.business.employees >= 1) {
    score += 10;
  }

  // Compliance readiness for procurement-class opportunities.
  if (needsProcurement && formalState === "formal") {
    score += 10;
    reasons.push("You meet the registration requirement.");
  }

  const revenueThreshold = requirements.find((r) => r.key === "revenue_threshold");
  const threshold = revenueThreshold ? numReq(revenueThreshold) : undefined;
  if (threshold !== undefined) {
    const revenue = ent.business.revenueMonthly;
    if (revenue !== null && revenue >= threshold) {
      score += 15;
      reasons.push(`Your revenue level meets the requirement.`);
    } else if (revenue !== null && revenue < threshold) {
      score -= 15;
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// --------------------------------------------------------------------
// Public entry point
// --------------------------------------------------------------------

export function scoreOpportunity(
  requirements: Requirement[],
  ent: MatchableEntrepreneur
): MatchResult {
  // Business facts (passport/verification) are more authoritative than the
  // self-reported assessment answer for formalisation.
  const formalState = ent.business.formalised ? "formal" : formalisation(ent.answers);

  const eligibility = evaluateEligibility(requirements, ent);
  const businessFit = evaluateBusinessFit(requirements, ent);
  const practicalFit = evaluatePracticalFit(requirements, ent);
  const readiness = evaluateReadiness(requirements, ent, formalState);

  const reasons = [...businessFit.reasons, ...readiness.reasons];

  // Practical fit does not gate eligibility — it only weighs the score and
  // produces friction. Ineligible is terminal (no meaningful score).
  let matchScore: number;
  if (eligibility.status === "ineligible") {
    matchScore = 0;
  } else {
    const weighted = businessFit.score * 0.4 + practicalFit.score * 0.3 + readiness.score * 0.3;
    matchScore = Math.max(0, Math.min(100, Math.round(weighted)));
  }

  const explanation = buildExplanation(matchScore, eligibility, practicalFit.friction, ent);

  return {
    matchScore,
    eligibility: eligibility.status,
    eligibilityReasons: eligibility.reasons,
    businessFit: businessFit.score,
    practicalFit: practicalFit.score,
    readiness: readiness.score,
    friction: practicalFit.friction,
    reasons,
    explanation,
  };
}

function buildExplanation(
  matchScore: number,
  eligibility: { status: EligibilityStatus; reasons: string[] },
  friction: FrictionItem[],
  ent: MatchableEntrepreneur
): string {
  if (eligibility.status === "ineligible") {
    return `This opportunity may not be a fit right now: ${eligibility.reasons.join(" ")}`;
  }
  const persona = ent.profile.journey.personaName;
  if (friction.length === 0) {
    return `This opportunity aligns with your current journey (${persona}) with little practical friction.`;
  }
  const frictionLabels = friction.map((f) => f.label.toLowerCase()).join(", ");
  return `Strong alignment with your journey (${persona}), with some practical friction to consider: ${frictionLabels}.`;
}

/**
 * Readiness against a specific opportunity — the numeric readiness
 * dimension from scoreOpportunity(), exposed separately for the spec's
 * `readiness_against_specific_opportunity(opportunityId)` requirement.
 */
export function readinessAgainstOpportunity(
  requirements: Requirement[],
  ent: MatchableEntrepreneur
): number {
  const formalState = ent.business.formalised ? "formal" : formalisation(ent.answers);
  return evaluateReadiness(requirements, ent, formalState).score;
}
