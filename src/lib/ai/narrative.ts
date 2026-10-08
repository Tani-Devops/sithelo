// ====================================================================
// Grounded AI narrative generation.
//
// AI is allowed to PRODUCE prose here — never to decide eligibility,
// classification, or anything the deterministic layer owns. Every prompt
// is built from already-derived, structured Sithelo data, and every call
// degrades gracefully to the deterministic explanation when AI is
// unavailable or unconfigured (AI is never the source of truth).
//
// PRIVACY (directive §17): these functions are SERVER-ONLY and the
// sanitised payloads deliberately exclude raw answers, names, dependant
// counts, household data, and financial detail. Only business-level,
// derived signals (persona, strengths, next moves, match dimensions) are
// sent to the provider.
// ====================================================================

import type { JourneyProfile } from "../classification/types";
import type { MatchResult } from "../matching/score";
import { complete } from "./index";

const SYSTEM =
  "You are Sithelo, a calm, human, South African entrepreneurship platform. " +
  "Write in plain, warm English. Never invent facts. Never add details not present in the data you are given. " +
  "Keep responses short (2-4 sentences). Do not use marketing jargon or motivational clichés.";

function sanitizeJourney(profile: JourneyProfile) {
  return {
    journey: profile.journey.personaName,
    strengths: profile.strengths,
    nextMoves: profile.nextMoves,
  };
}

/**
 * Generate a short, grounded narrative for a journey profile. Returns the
 * deterministic explanation if AI fails or is not configured.
 */
export async function generateJourneyNarrative(profile: JourneyProfile): Promise<string> {
  const context = sanitizeJourney(profile);
  try {
    const result = await complete({
      system: SYSTEM,
      prompt:
        "Write a short, grounded summary of this entrepreneur's current journey profile. " +
        "Use only the data provided:\n" +
        JSON.stringify(context, null, 2),
      temperature: 0.5,
      maxTokens: 300,
    });
    const text = result.text.trim();
    return text.length > 0 ? text : profile.journey.explanation;
  } catch {
    return profile.journey.explanation;
  }
}

/**
 * Generate a grounded explanation of why an opportunity matches (or not).
 * Returns the deterministic explanation if AI fails or is not configured.
 */
export async function generateMatchNarrative(
  match: MatchResult,
  opportunityTitle: string
): Promise<string> {
  const context = {
    opportunity: opportunityTitle,
    matchScore: match.matchScore,
    eligibility: match.eligibility,
    reasons: match.reasons,
    friction: match.friction.map((f) => f.label),
  };
  try {
    const result = await complete({
      system: SYSTEM,
      prompt:
        "Explain, in plain language, why this opportunity does or does not fit this entrepreneur. " +
        "Use only the data provided, and be honest about friction:\n" +
        JSON.stringify(context, null, 2),
      temperature: 0.4,
      maxTokens: 300,
    });
    const text = result.text.trim();
    return text.length > 0 ? text : match.explanation;
  } catch {
    return match.explanation;
  }
}
