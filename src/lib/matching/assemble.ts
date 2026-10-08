// ====================================================================
// Server-side assembly of a MatchableEntrepreneur from persisted data.
// Reads the passport + verifications (RLS-scoped) and the latest
// assessment snapshot, then constructs the inputs for the matching engine.
//
// Matching is computed in the Next.js app (not the edge function) because
// practical fit depends on the entrepreneur's tier-0 context, which only
// the owner can see. Institutions never receive this context.
// ====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { snapshotToJourneyProfile, type AssessmentSnapshotRow } from "../assessment/read";
import type { MatchableEntrepreneur, BusinessFacts } from "./score";

export async function assembleMatchableEntrepreneur(
  supabase: SupabaseClient,
  userId: string
): Promise<MatchableEntrepreneur | null> {
  const { data: passport } = await supabase
    .from("business_passports")
    .select("id, business_type, years_trading, employees_count, trust_score, bbbee_level, annual_turnover, industry")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!passport) return null;

  const { data: snapshot } = await supabase
    .from("assessment_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapshot) return null;

  const { data: verifications } = await supabase
    .from("verifications")
    .select("verification_type, status")
    .eq("passport_id", passport.id);

  const verifiedCompliance = (verifications ?? [])
    .filter((v: { status: string }) => v.status === "verified")
    .map((v: { verification_type: string }) => v.verification_type);

  const business: BusinessFacts = {
    formalised: verifiedCompliance.includes("cipc"),
    revenueMonthly: passport.annual_turnover ? Number(passport.annual_turnover) / 12 : null,
    yearsTrading: passport.years_trading ?? null,
    employees: passport.employees_count ?? null,
    trustScore: passport.trust_score ?? null,
    bbbeeLevel: passport.bbbee_level ?? null,
    verifiedCompliance,
    industry: passport.industry ?? null,
  };

  return {
    profile: snapshotToJourneyProfile(snapshot as unknown as AssessmentSnapshotRow),
    answers: {},
    business,
  };
}
