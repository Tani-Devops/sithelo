// ====================================================================
// POST /api/onboarding/complete
//
// Writes everything collected across the "Tell Us About Yourself"
// wizard (directive §5) in one request:
//   business_passports (identity)         — session-bound client, RLS +
//   entrepreneur_profiles (reality)         column grants enforce
//   entrepreneur_financial_snapshots        ownership & block any
//   entrepreneur_needs / entrepreneur_goals scored/verification field
//                                            from being set here.
// owner_id/user_id are always taken from the authenticated session,
// never from the request body — an entrepreneur cannot create a
// passport or profile on someone else's behalf by editing the payload.
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

  const { data: existingPassport } = await supabase
    .from("business_passports")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (existingPassport) {
    return NextResponse.json({ error: "You already have a Business Passport." }, { status: 409 });
  }

  // ---------- Business Passport ----------
  const { data: passport, error: passportErr } = await supabase
    .from("business_passports")
    .insert({
      owner_id: userId,
      business_name: clean(body.business_name),
      business_type: body.business_type && BUSINESS_TYPES.has(body.business_type) ? body.business_type : null,
      industry: clean(body.industry) ?? null,
      province: clean(body.province) ?? null,
      municipality: clean(body.municipality) ?? null,
      business_description: clean(body.business_description) ?? null,
      years_trading: typeof body.years_trading === "number" ? body.years_trading : null,
      employees_count: typeof body.employees_count === "number" ? body.employees_count : null,
    })
    .select("id")
    .single();

  if (passportErr || !passport) {
    return NextResponse.json({ error: "Could not save your business details." }, { status: 500 });
  }

  // ---------- Entrepreneur reality profile ----------
  const { data: entrepreneurProfile, error: profileErr } = await supabase
    .from("entrepreneur_profiles")
    .insert({
      user_id: userId,
      province: clean(body.province) ?? null,
      municipality: clean(body.municipality) ?? null,
      primary_income_source: typeof body.primary_income_source === "boolean" ? body.primary_income_source : null,
      dependants_count: typeof body.dependants_count === "number" ? body.dependants_count : null,
      household_income_dependency: body.household_income_dependency && DEPENDENCY.has(body.household_income_dependency) ? body.household_income_dependency : null,
      operating_location_type: clean(body.operating_location_type) ?? null,
      transport_mode: clean(body.transport_mode) ?? null,
      internet_access: typeof body.internet_access === "boolean" ? body.internet_access : null,
      electricity_access: typeof body.electricity_access === "boolean" ? body.electricity_access : null,
      premises_status: clean(body.premises_status) ?? null,
    })
    .select("id")
    .single();

  if (profileErr || !entrepreneurProfile) {
    return NextResponse.json({ error: "Could not save your details." }, { status: 500 });
  }

  // ---------- Financial snapshot (optional — ranges only, never exact figures) ----------
  if (body.weekly_revenue_range || body.weekly_business_expense_range || body.personal_draw_range) {
    await supabase.from("entrepreneur_financial_snapshots").insert({
      entrepreneur_profile_id: entrepreneurProfile.id,
      weekly_revenue_range: REVENUE_RANGES.has(body.weekly_revenue_range ?? "") ? body.weekly_revenue_range : null,
      weekly_business_expense_range: REVENUE_RANGES.has(body.weekly_business_expense_range ?? "") ? body.weekly_business_expense_range : null,
      personal_draw_range: REVENUE_RANGES.has(body.personal_draw_range ?? "") ? body.personal_draw_range : null,
      income_consistency: CONSISTENCY.has(body.income_consistency ?? "") ? body.income_consistency : null,
    });
  }

  // ---------- Needs ----------
  const needs = Array.isArray(body.needs) ? body.needs.filter((n) => typeof n === "string" && n.length < 100).slice(0, 20) : [];
  if (needs.length > 0) {
    await supabase.from("entrepreneur_needs").insert(
      needs.map((need_type, i) => ({ entrepreneur_profile_id: entrepreneurProfile.id, need_type, priority: needs.length - i }))
    );
  }

  // ---------- Goals ----------
  const goals = Array.isArray(body.goals) ? body.goals.slice(0, 10) : [];
  if (goals.length > 0) {
    await supabase.from("entrepreneur_goals").insert(
      goals
        .filter((g) => g && typeof g.goal_type === "string" && g.goal_type.length < 100)
        .map((g, i) => ({
          entrepreneur_profile_id: entrepreneurProfile.id,
          goal_type: g.goal_type,
          notes: clean(g.notes) ?? null,
          priority: goals.length - i,
        }))
    );
  }

  // ---------- First persona, same request ----------
  const service = createServiceClient();
  const result = await recomputePersonaForUser(service, userId);

  return NextResponse.json({
    passport_id: passport.id,
    persona: result.ok ? result.persona : null,
    next_step: result.ok ? result.next_step : null,
  });
}
