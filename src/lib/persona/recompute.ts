// ====================================================================
// recomputePersonaForUser — the actual persona/next-step computation,
// factored out of /api/persona/recompute so onboarding completion can
// call it in-process (same request, same service-role client) instead
// of round-tripping through HTTP to itself.
//
// Callers are responsible for their own auth check before calling this
// — it takes a service client and trusts the userId it's given. Never
// expose this directly to a client component; only Route Handlers that
// have already run requireEntrepreneur() should call it.
// ====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { determinePersona, type DependencyLevel, type RevenueRange } from "./determinePersona";
import { determineNextStep } from "../nextStep/determineNextStep";

const TRACKED_VERIFICATION_TYPES = ["cipc", "sars", "vat", "bbbee", "cidb", "municipal_supplier", "insurance", "bank"];

export type RecomputeResult =
  | { ok: true; persona: Record<string, unknown>; next_step: ReturnType<typeof determineNextStep> }
  | { ok: false; status: number; error: string };

export async function recomputePersonaForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<RecomputeResult> {
  const { data: entrepreneurProfile } = await supabase
    .from("entrepreneur_profiles")
    .select("id, household_income_dependency")
    .eq("user_id", userId)
    .maybeSingle();

  if (!entrepreneurProfile) {
    return { ok: false, status: 409, error: "Complete onboarding before Sithelo can build your persona." };
  }

  const { data: passport } = await supabase
    .from("business_passports")
    .select("id, business_type, employees_count, years_trading, readiness_score, trust_score, profile_completeness, industry")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!passport) {
    return { ok: false, status: 409, error: "Start your Business Passport before Sithelo can build your persona." };
  }

  const [{ data: snapshot }, { data: needs }, { data: goals }, { data: capabilities }, { data: verifications }, { data: topMatch }] =
    await Promise.all([
      supabase
        .from("entrepreneur_financial_snapshots")
        .select("weekly_revenue_range, income_consistency")
        .eq("entrepreneur_profile_id", entrepreneurProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("entrepreneur_needs").select("need_type").eq("entrepreneur_profile_id", entrepreneurProfile.id),
      supabase.from("entrepreneur_goals").select("goal_type").eq("entrepreneur_profile_id", entrepreneurProfile.id),
      supabase.from("business_capabilities").select("name").eq("passport_id", passport.id),
      supabase.from("verifications").select("verification_type, status").eq("passport_id", passport.id),
      supabase
        .from("matches")
        .select("opportunity_id, match_score, opportunities(title)")
        .eq("passport_id", passport.id)
        .order("match_score", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const verifiedTypes = new Set(
    (verifications ?? []).filter((v: { status: string }) => v.status === "verified").map((v: { verification_type: string }) => v.verification_type)
  );
  const complianceCompleteCount = TRACKED_VERIFICATION_TYPES.filter((t) => verifiedTypes.has(t)).length;
  const cipcVerified = verifiedTypes.has("cipc");
  const cipcAttempted = (verifications ?? []).some((v: { verification_type: string }) => v.verification_type === "cipc");

  const businessFormalization: "informal" | "formalising" | "formal" =
    cipcVerified ? "formal" : cipcAttempted || passport.business_type ? "formalising" : "informal";

  const marketAccess: "none" | "limited" | "established" =
    (passport.readiness_score ?? 0) >= 75 ? "established" : (passport.readiness_score ?? 0) >= 40 ? "limited" : "none";

  const persona = determinePersona({
    businessFormalization,
    revenueRange: (snapshot?.weekly_revenue_range as RevenueRange) ?? null,
    yearsTrading: passport.years_trading,
    employees: passport.employees_count,
    customers: null,
    complianceCompleteCount,
    complianceTotalCount: TRACKED_VERIFICATION_TYPES.length,
    trustScore: passport.trust_score,
    readinessScore: passport.readiness_score,
    needs: (needs ?? []).map((n: { need_type: string }) => n.need_type),
    capabilities: (capabilities ?? []).map((c: { name: string }) => c.name),
    goals: (goals ?? []).map((g: { goal_type: string }) => g.goal_type),
    householdDependency: (entrepreneurProfile.household_income_dependency as DependencyLevel) ?? null,
    marketAccess,
  });

  const { data: persistedPersona, error: personaError } = await supabase
    .from("entrepreneur_persona_state")
    .upsert(
      {
        entrepreneur_profile_id: entrepreneurProfile.id,
        persona_number: persona.persona_number,
        persona_name: persona.persona_name,
        explanation: persona.explanation,
        strengths: persona.strengths,
        constraints: persona.constraints,
        recommended_focus: persona.recommended_focus,
        computed_at: new Date().toISOString(),
        computed_by: "rules_engine_v1",
      },
      { onConflict: "entrepreneur_profile_id" }
    )
    .select()
    .single();

  if (personaError || !persistedPersona) {
    return { ok: false, status: 500, error: "Could not save persona." };
  }

  const matchRow = topMatch as { opportunity_id: string; match_score: number; opportunities: { title: string } | { title: string }[] } | null;
  const matchTitle = matchRow ? (Array.isArray(matchRow.opportunities) ? matchRow.opportunities[0]?.title : matchRow.opportunities?.title) : null;

  const nextStep = determineNextStep({
    persona,
    businessFormalization,
    profileCompleteness: passport.profile_completeness ?? 0,
    complianceRatio: complianceCompleteCount / TRACKED_VERIFICATION_TYPES.length,
    needs: (needs ?? []).map((n: { need_type: string }) => n.need_type),
    householdDependency: (entrepreneurProfile.household_income_dependency as DependencyLevel) ?? null,
    topMatch: matchRow
      ? {
          opportunity_id: matchRow.opportunity_id,
          title: matchTitle ?? "this opportunity",
          match_score: matchRow.match_score,
          requires_significant_financial_commitment: false,
        }
      : null,
  });

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "persona.recomputed",
    entity_type: "entrepreneur_persona_state",
    entity_id: persistedPersona.id,
    metadata: { persona_number: persona.persona_number },
  });

  return { ok: true, persona: persistedPersona, next_step: nextStep };
}
