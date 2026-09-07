// ====================================================================
// POST /api/onboarding/complete
//
// Writes everything collected across the "Tell Us About Yourself"
// wizard (directive §5) in one request via the
// complete_entrepreneur_onboarding() Postgres function (see migration
// 026), which inserts business_passports (identity), entrepreneur_
// profiles (reality), entrepreneur_financial_snapshots, entrepreneur_
// needs, and entrepreneur_goals inside a SINGLE transaction — all or
// nothing. This used to be five separate sequential client-side
// inserts; if any insert after the first failed, the business_
// passports row stayed committed with no profile behind it, and the
// user got permanently stuck seeing "You already have a Business
// Passport" despite never completing onboarding. See migration 026
// for the full writeup.
//
// owner_id/user_id are always taken from the authenticated session
// inside that function (auth.uid()), never from the request body — an
// entrepreneur cannot create a passport or profile on someone else's
// behalf by editing the payload.
//
// A brand-new informal entrepreneur may have no business name yet, no
// registration, no revenue history — every field the schema doesn't
// require is optional here too (directive: no CIPC prerequisite, no
// forced precision on financials).
//
// After writing, computes the first Sithelo Persona in the same
// request (service client, since only it can write
// entrepreneur_persona_state) so the "magic moment" screen has real
// data on first paint — no separate round trip required.
// ====================================================================
import { NextResponse } from "next/server";
import { requireEntrepreneur } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recomputePersonaForUser } from "@/lib/persona/recompute";

const REVENUE_RANGES = new Set(["under_1k", "1k_2_5k", "2_5k_5k", "5k_10k", "10k_25k", "25k_plus"]);
const CONSISTENCY = new Set(["consistent", "seasonal", "unpredictable"]);
const DEPENDENCY = new Set(["low", "medium", "high"]);
const BUSINESS_TYPES = new Set(["sole_proprietor", "private_company", "close_corporation", "partnership", "npo", "cooperative"]);

interface OnboardingBody {
  province?: string;
  municipality?: string;

  business_name: string;
  business_type?: string;
  industry?: string;
  years_trading?: number;
  business_description?: string;
  primary_income_source?: boolean;

  weekly_revenue_range?: string;
  weekly_business_expense_range?: string;
  personal_draw_range?: string;
  income_consistency?: string;
  employees_count?: number;

  dependants_count?: number;
  household_income_dependency?: string;
  operating_location_type?: string;
  transport_mode?: string;
  internet_access?: boolean;
  electricity_access?: boolean;
  premises_status?: string;

  needs: string[]; // need_type values
  goals: { goal_type: string; notes?: string }[];
}

function clean(s: unknown): string | undefined {
  const v = typeof s === "string" ? s.trim() : "";
  return v.length > 0 ? v.slice(0, 2000) : undefined;
}

export async function POST(req: Request) {
  const { userId } = await requireEntrepreneur();
  const supabase = await createClient();

  let body: OnboardingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.business_name || clean(body.business_name) === undefined) {
    return NextResponse.json({ error: "Tell us what you're building first." }, { status: 400 });
  }

  const needs = Array.isArray(body.needs) ? body.needs.filter((n) => typeof n === "string" && n.length < 100).slice(0, 20) : [];
  const goals = (Array.isArray(body.goals) ? body.goals.slice(0, 10) : [])
    .filter((g) => g && typeof g.goal_type === "string" && g.goal_type.length < 100)
    .map((g) => ({ goal_type: g.goal_type, notes: clean(g.notes) ?? null }));

  // ---------- Single atomic write ----------
  // All the entrepreneur's onboarding data (passport, reality profile,
  // financial snapshot, needs, goals) is written inside one Postgres
  // transaction here — see migration 026. Either everything is saved,
  // or nothing is; there's no partial-failure state that can leave a
  // passport behind with no profile and lock the user out.
  const { data: onboardingResult, error: onboardingErr } = await supabase
    .rpc("complete_entrepreneur_onboarding", {
      p_business_name: clean(body.business_name),
      p_business_type: body.business_type && BUSINESS_TYPES.has(body.business_type) ? body.business_type : null,
      p_industry: clean(body.industry) ?? null,
      p_province: clean(body.province) ?? null,
      p_municipality: clean(body.municipality) ?? null,
      p_business_description: clean(body.business_description) ?? null,
      p_years_trading: typeof body.years_trading === "number" ? body.years_trading : null,
      p_employees_count: typeof body.employees_count === "number" ? body.employees_count : null,
      p_primary_income_source: typeof body.primary_income_source === "boolean" ? body.primary_income_source : null,
      p_dependants_count: typeof body.dependants_count === "number" ? body.dependants_count : null,
      p_household_income_dependency: body.household_income_dependency && DEPENDENCY.has(body.household_income_dependency) ? body.household_income_dependency : null,
      p_operating_location_type: clean(body.operating_location_type) ?? null,
      p_transport_mode: clean(body.transport_mode) ?? null,
      p_internet_access: typeof body.internet_access === "boolean" ? body.internet_access : null,
      p_electricity_access: typeof body.electricity_access === "boolean" ? body.electricity_access : null,
      p_premises_status: clean(body.premises_status) ?? null,
      p_weekly_revenue_range: REVENUE_RANGES.has(body.weekly_revenue_range ?? "") ? body.weekly_revenue_range : null,
      p_weekly_business_expense_range: REVENUE_RANGES.has(body.weekly_business_expense_range ?? "") ? body.weekly_business_expense_range : null,
      p_personal_draw_range: REVENUE_RANGES.has(body.personal_draw_range ?? "") ? body.personal_draw_range : null,
      p_income_consistency: CONSISTENCY.has(body.income_consistency ?? "") ? body.income_consistency : null,
      p_needs: needs,
      p_goals: goals,
    })
    .single();

  if (onboardingErr || !onboardingResult) {
    // 'already_onboarded' (raised explicitly) and 23505 (unique_violation,
    // the race-condition safety net) both mean the same thing to the user.
    if (onboardingErr?.message?.includes("already_onboarded") || onboardingErr?.code === "23505") {
      return NextResponse.json({ error: "You already have a Business Passport." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save your business details." }, { status: 500 });
  }

  const passportId = (onboardingResult as { passport_id: string }).passport_id;

  // ---------- First persona, same request ----------
  const service = createServiceClient();
  const result = await recomputePersonaForUser(service, userId);

  return NextResponse.json({
    passport_id: passportId,
    persona: result.ok ? result.persona : null,
    next_step: result.ok ? result.next_step : null,
  });
}
