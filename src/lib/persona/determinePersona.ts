/**
 * Sithelo Persona Engine — deterministic, explainable, rules-based.
 *
 * Per MASTER_BUILD_DIRECTIVE section 7-9:
 *   - NOT an AI classifier. NOT an opaque score. NOT a wealth ranking.
 *   - Every explanation, strength, and constraint must be traceable to
 *     an actual input field. Never invent facts.
 *   - Evaluates PERSON + BUSINESS + REALITY together (section 9) —
 *     household context can shape recommended_focus, but must never
 *     gate opportunity eligibility or be shown to institutions.
 *
 * This module is intentionally pure (no DB/network access) so it can
 * be unit-tested directly and called from either a Postgres RPC
 * wrapper or an Edge Function without duplicating logic.
 */

export type RevenueRange =
  | 'under_1k' | '1k_2_5k' | '2_5k_5k' | '5k_10k' | '10k_25k' | '25k_plus';

export type DependencyLevel = 'low' | 'medium' | 'high';

export interface PersonaInput {
  // Business formalization
  businessFormalization: 'informal' | 'formalising' | 'formal';
  revenueRange: RevenueRange | null;
  yearsTrading: number | null;
  employees: number | null;
  customers: number | null;
  complianceCompleteCount: number; // how many of the tracked verification types are 'verified'
  complianceTotalCount: number;
  trustScore: number | null; // 0-100, from business_passports.trust_score
  readinessScore: number | null; // 0-100, from business_passports.readiness_score

  // Needs / capabilities / goals (arrays of stored need_type / goal_type strings)
  needs: string[];
  capabilities: string[];
  goals: string[];

  // Reality (used only to shape explanation/recommended_focus, never eligibility)
  householdDependency: DependencyLevel | null;
  marketAccess: 'none' | 'limited' | 'established' | null;
}

export interface PersonaResult {
  persona_number: number;
  persona_name: string;
  explanation: string;
  strengths: string[];
  constraints: string[];
  recommended_focus: string;
}

const PERSONA_NAMES: Record<number, string> = {
  1: 'The Starter',
  2: 'The Hustler',
  3: 'The Builder',
  4: 'The Formaliser',
  5: 'The Operator',
  6: 'The Growth Seeker',
  7: 'The Opportunity Ready',
  8: 'The Market Ready',
  9: 'The Scaler',
  10: 'The Economic Builder',
};

const REVENUE_ORDER: RevenueRange[] = [
  'under_1k', '1k_2_5k', '2_5k_5k', '5k_10k', '10k_25k', '25k_plus',
];

function revenueIndex(r: RevenueRange | null): number {
  if (!r) return -1;
  return REVENUE_ORDER.indexOf(r);
}

/**
 * Determine the entrepreneur's current Sithelo Persona from stored data only.
 * Deterministic: identical inputs always produce identical output.
 */
export function determinePersona(input: PersonaInput): PersonaResult {
  const revIdx = revenueIndex(input.revenueRange);
  const complianceRatio = input.complianceTotalCount > 0
    ? input.complianceCompleteCount / input.complianceTotalCount
    : 0;
  const hasEmployees = (input.employees ?? 0) > 0;
  const consistentDemand = revIdx >= 2; // 2.5k/week+ treated as established demand
  const strongCapability = input.capabilities.length >= 2 || (input.readinessScore ?? 0) >= 60;
  const marketAccessGap = input.marketAccess === 'none' || input.marketAccess === 'limited';
  const highReadiness = (input.readinessScore ?? 0) >= 75 && (input.trustScore ?? 0) >= 75;
  const jobCreator = (input.employees ?? 0) >= 5;

  let personaNumber: number;

  if (input.businessFormalization === 'informal' && (revIdx < 1 || input.yearsTrading == null || input.yearsTrading < 1)) {
    personaNumber = 1; // Starter
  } else if (input.businessFormalization === 'informal' && revIdx >= 1) {
    personaNumber = 2; // Hustler
  } else if (consistentDemand && !hasEmployees && input.businessFormalization !== 'formal') {
    personaNumber = 3; // Builder — demand exists but founder-dependent, still informal-ish
  } else if (input.businessFormalization === 'formalising' || (input.businessFormalization === 'formal' && complianceRatio < 0.5)) {
    personaNumber = 4; // Formaliser
  } else if (input.businessFormalization === 'formal' && !consistentDemand) {
    personaNumber = 5; // Operator
  } else if (consistentDemand && marketAccessGap && (input.needs.length > 0)) {
    personaNumber = 6; // Growth Seeker
  } else if (strongCapability && complianceRatio >= 0.5 && marketAccessGap) {
    personaNumber = 7; // Opportunity Ready
  } else if (strongCapability && input.marketAccess === 'limited' && complianceRatio >= 0.75) {
    personaNumber = 8; // Market Ready
  } else if (highReadiness && !jobCreator) {
    personaNumber = 9; // Scaler
  } else if (highReadiness && jobCreator) {
    personaNumber = 10; // Economic Builder
  } else {
    // Fallback: place by revenue/readiness rather than guessing upward
    personaNumber = consistentDemand ? 5 : 2;
  }

  const strengths: string[] = [];
  const constraints: string[] = [];

  if (consistentDemand) strengths.push('Consistent revenue');
  if ((input.customers ?? 0) > 0) strengths.push('Repeat customers');
  if (input.yearsTrading != null && input.yearsTrading >= 1) strengths.push('Operating experience');
  if (input.capabilities.length > 0) strengths.push(`Demonstrated capability: ${input.capabilities.join(', ')}`);
  if (complianceRatio >= 0.75) strengths.push('Strong verification profile');

  if (input.businessFormalization === 'informal') constraints.push('Not yet formally registered');
  if (marketAccessGap) constraints.push('Limited market access');
  if (complianceRatio > 0 && complianceRatio < 0.5) constraints.push('Incomplete verification/compliance');
  if (input.needs.includes('equipment')) constraints.push('Equipment capacity');
  if (input.needs.includes('funding')) constraints.push('Access to funding');
  if (strengths.length === 0) strengths.push('Early-stage momentum');
  if (constraints.length === 0) constraints.push('No major blockers identified from current data');

  const explanation = buildExplanation(personaNumber, input, consistentDemand, marketAccessGap);
  const recommended_focus = buildRecommendedFocus(personaNumber, input, marketAccessGap);

  return {
    persona_number: personaNumber,
    persona_name: PERSONA_NAMES[personaNumber],
    explanation,
    strengths,
    constraints,
    recommended_focus,
  };
}

function buildExplanation(
  personaNumber: number,
  input: PersonaInput,
  consistentDemand: boolean,
  marketAccessGap: boolean,
): string {
  switch (personaNumber) {
    case 1:
      return 'You\u2019re turning an activity into income. Sithelo is here to help you build consistency and structure.';
    case 2:
      return 'You\u2019re generating income and customers, but still operating informally or with limited structure.';
    case 3:
      return 'Your business has established demand, but it still depends heavily on you and is still developing infrastructure.';
    case 4:
      return 'You have or are pursuing formal business structures, and need compliance and credibility to unlock larger opportunities.';
    case 5:
      return 'You have a functioning business and operating capacity, but need stronger systems, consistency, or market access.';
    case 6:
      return 'Your business has established demand and operating experience, but your current growth is constrained by ' +
        (input.needs.length > 0 ? input.needs.join(' and ') : 'resource access') + '.';
    case 7:
      return 'You have enough capability and readiness to start pursuing meaningful institutional opportunities.';
    case 8:
      return 'You have capability and operational maturity, but need access to buyers, contracts, and markets.';
    case 9:
      return 'You have proven demand and are primarily constrained by infrastructure, capital, people, or expansion capacity.';
    case 10:
      return 'You\u2019re a mature business actively creating jobs, opportunity, and economic value beyond yourself.';
    default:
      return 'Sithelo is building a picture of your business from what you\u2019ve told us.';
  }
}

function buildRecommendedFocus(
  personaNumber: number,
  input: PersonaInput,
  marketAccessGap: boolean,
): string {
  if (input.needs.includes('registration') || input.businessFormalization === 'informal') {
    return 'Formalise your business to unlock more opportunities.';
  }
  if (personaNumber <= 5 && marketAccessGap) {
    return 'Complete your Business Passport before pursuing larger buyers.';
  }
  if (marketAccessGap) {
    return 'Explore institutional opportunities that match your current capability.';
  }
  if (input.householdDependency === 'high') {
    return 'Prioritise lower-risk, market-access opportunities before larger financial commitments.';
  }
  return 'Increase capacity and connect with buyers before taking on significant new financial risk.';
}
