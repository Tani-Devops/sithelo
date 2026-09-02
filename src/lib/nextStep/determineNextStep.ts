/**
 * Sithelo Next Step Engine — deterministic, explainable, rules-based.
 *
 * Per MASTER_BUILD_DIRECTIVE section 12: no AI dependency, every
 * recommendation must be traceable to actual stored data (persona
 * state, passport completeness, needs, and — where available — real
 * opportunity matches from the existing matching backend).
 */

import type { PersonaResult } from '../persona/determinePersona';

export interface NextStepInput {
  persona: PersonaResult;
  businessFormalization: 'informal' | 'formalising' | 'formal';
  profileCompleteness: number; // 0-100, from business_passports
  complianceRatio: number; // 0-1
  needs: string[];
  householdDependency: 'low' | 'medium' | 'high' | null;
  topMatch: {
    opportunity_id: string;
    title: string;
    match_score: number;
    requires_significant_financial_commitment: boolean;
  } | null;
}

export interface NextStepResult {
  title: string;
  explanation: string;
  reason: string;
  action: string;
  destination: string;
  priority: 'high' | 'medium' | 'low';
}

export function determineNextStep(input: NextStepInput): NextStepResult {
  // Highest priority: a strong, ready-to-apply match exists.
  if (
    input.topMatch &&
    input.topMatch.match_score >= 75 &&
    input.complianceRatio >= 0.75 &&
    !(input.householdDependency === 'high' && input.topMatch.requires_significant_financial_commitment)
  ) {
    return {
      title: `Apply to ${input.topMatch.title}`,
      explanation: `You\u2019re a ${Math.round(input.topMatch.match_score)}% match for this opportunity based on your Business Passport.`,
      reason: 'Strong match and verification profile.',
      action: 'Apply now',
      destination: `/entrepreneur/opportunities/${input.topMatch.opportunity_id}`,
      priority: 'high',
    };
  }

  if (input.businessFormalization === 'informal' && input.needs.includes('registration') === false) {
    // consistent revenue but informal → formalise
    return {
      title: 'Formalise your business',
      explanation: 'Your business is active, but formal registration will unlock more institutional opportunities.',
      reason: 'Business is informal.',
      action: 'Start formalising',
      destination: '/entrepreneur/passport',
      priority: 'medium',
    };
  }

  if (input.profileCompleteness < 70 || input.complianceRatio < 0.5) {
    return {
      title: 'Complete your Business Passport',
      explanation: 'Your business has established customers and operating capacity, but your verification profile is incomplete. Completing your Business Passport could unlock institutional opportunities.',
      reason: 'Passport incomplete or verification ratio below 50%.',
      action: 'Complete my Passport',
      destination: '/entrepreneur/passport',
      priority: 'high',
    };
  }

  if (input.needs.includes('equipment')) {
    return {
      title: 'Explore equipment opportunities',
      explanation: 'Equipment is your biggest stated constraint right now. Sithelo will surface relevant equipment-support opportunities.',
      reason: 'Equipment listed as a current need.',
      action: 'View opportunities',
      destination: '/entrepreneur/opportunities',
      priority: 'medium',
    };
  }

  if (input.persona.persona_number >= 6) {
    return {
      title: 'Explore institutional opportunities',
      explanation: 'Your capability and readiness are strong enough to start pursuing institutional buyers.',
      reason: `Current persona: ${input.persona.persona_name}.`,
      action: 'View opportunities',
      destination: '/entrepreneur/opportunities',
      priority: 'medium',
    };
  }

  return {
    title: 'Keep building your Business Passport',
    explanation: 'A more complete profile helps Sithelo find opportunities that genuinely fit your business.',
    reason: 'No stronger signal available yet from stored data.',
    action: 'Continue my Passport',
    destination: '/entrepreneur/passport',
    priority: 'low',
  };
}
