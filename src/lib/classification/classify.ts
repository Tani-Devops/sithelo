// ====================================================================
// Sithelo two-layer classification engine — deterministic, auditable.
//
// Layer 1: primary journey persona (1 of 10 stages), from a decision
//          table over explicit stage signals.
// Layer 2: multidimensional context (economic dependence, household
//          responsibility, employment attachment, time capacity, care
//          responsibilities, financial resilience, risk capacity, digital
//          accessibility, transport accessibility, support preference,
//          self-efficacy, perceived control, entrepreneurial identity,
//          growth aspiration, motivation).
//
// This is intentionally NOT an AI classifier and NOT a single opaque
// score. Every output field traces back to specific answers. Pure (no DB,
// no network) so it can be unit-tested directly.
//
// It mirrors and extends the original src/lib/persona/determinePersona.ts
// (which remains the source for the existing onboarding path); this engine
// is the richer, two-layer successor used by the journey assessment.
// ====================================================================

import type { AnswerMap } from "../assessment/types";
import { FRAMEWORK_VERSION } from "../assessment/bank";
import { computeOpportunityReadiness } from "../readiness/readiness";
import type {
  AccessFlag,
  CapabilityGap,
  Constraint,
  ContextDimensions,
  EmploymentAttachment,
  JourneyProfile,
  JourneyStage,
  Level,
  Motivation,
  SelfEfficacy,
} from "./types";
import { PERSONA_NAMES } from "./types";

// --------------------------------------------------------------------
// Answer readers (null-safe)
// --------------------------------------------------------------------

function str(answers: AnswerMap, id: string): string | undefined {
  const v = answers[id];
  return typeof v === "string" ? v : undefined;
}

function bool(answers: AnswerMap, id: string): boolean {
  return answers[id] === true;
}

function multi(answers: AnswerMap, id: string): string[] {
  const v = answers[id];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
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

// --------------------------------------------------------------------
// Level helpers
// --------------------------------------------------------------------

function levelFromScore(score: number): Level {
  if (score >= 0.66) return "high";
  if (score >= 0.34) return "medium";
  return "low";
}

// --------------------------------------------------------------------
// Capability task definitions (single source of truth for labels)
// --------------------------------------------------------------------

export const CAPABILITY_TASKS: Array<{ id: string; label: string }> = [
  { id: "j_finding_customers", label: "Finding customers" },
  { id: "j_setting_prices", label: "Setting prices" },
  { id: "j_selling", label: "Selling" },
  { id: "j_managing_cash", label: "Managing cash flow" },
  { id: "j_record_keeping", label: "Record keeping" },
  { id: "j_applying_funding", label: "Applying for funding" },
  { id: "j_formal_documents", label: "Completing formal documents" },
  { id: "j_negotiation", label: "Negotiating" },
  { id: "j_managing_employees", label: "Managing people" },
  { id: "j_digital_tools", label: "Using digital tools" },
  { id: "j_planning_growth", label: "Planning for growth" },
];

// --------------------------------------------------------------------
// Layer 1 — journey stage decision table
// --------------------------------------------------------------------

interface StageSignals {
  earns: boolean;
  customers: boolean;
  repeat: boolean;
  consistent: boolean;
  formal: boolean;
  formalising: boolean;
  founderIndependent: boolean;
  hasTeam: boolean;
  jobCreator: boolean;
  suppliers: boolean;
  growthIntent: boolean; // "strong growth" but not "scale"
  scaleIntent: boolean; // "scale significantly"
  strongCapability: boolean;
  marketEvidence: boolean; // growing customers + repeat
  strategic: boolean; // scale + job creator + formal + repeat
}

function deriveStageSignals(answers: AnswerMap, selfEfficacy: SelfEfficacy): StageSignals {
  const earns = bool(answers, "e_earns_money");
  const customersRaw = str(answers, "e_customers");
  const repeatRaw = str(answers, "e_repeat_customers");
  const consistency = str(answers, "e_revenue_consistency");
  const formalState = str(answers, "e_formalisation");
  const employees = str(answers, "e_employees");
  const ambition = str(answers, "g_growth_ambition");

  const customers = customersRaw === "a_few" || customersRaw === "steady" || customersRaw === "growing";
  const repeat = repeatRaw === "some" || repeatRaw === "mostly";
  const consistent = consistency === "consistent";
  const formal = formalState === "formal";
  const formalising = formalState === "in_progress";
  const founderIndependent = str(answers, "e_business_dependency") === "yes";
  const hasTeam = employees === "1_4" || employees === "5_plus";
  const jobCreator = employees === "5_plus";
  const suppliers = str(answers, "e_suppliers") === "established";
  const growthIntent = ambition === "strong_growth";
  const scaleIntent = ambition === "scale";
  const strongCapability = selfEfficacy.overall >= 3.5;
  const marketEvidence = customersRaw === "growing" && repeat;
  const strategic = scaleIntent && jobCreator && formal && repeat;

  return {
    earns, customers, repeat, consistent, formal, formalising,
    founderIndependent, hasTeam, jobCreator, suppliers,
    growthIntent, scaleIntent, strongCapability, marketEvidence, strategic,
  };
}

/** Determine the primary journey stage from a decision table. */
export function determineJourneyStage(
  answers: AnswerMap,
  selfEfficacy: SelfEfficacy
): JourneyStage {
  const s = deriveStageSignals(answers, selfEfficacy);

  // Ordered decision table — first match wins.
  let personaNumber: number;
  let fired: string[] = [];

  if (!s.earns || !s.customers) {
    personaNumber = 1;
    fired = s.earns ? ["earns_money", "no_customers"] : ["no_income"];
  } else if (s.customers && !s.repeat && !s.formal) {
    personaNumber = 2;
    fired = ["has_customers", "no_repeat_customers", "informal"];
  } else if (s.strategic) {
    personaNumber = 10;
    fired = ["formal", "repeat_customers", "scale_intent", "job_creator"];
  } else if (s.scaleIntent && s.repeat) {
    personaNumber = 9;
    fired = ["repeat_customers", "scale_intent"];
  } else if (s.growthIntent && s.repeat) {
    personaNumber = 6;
    fired = ["repeat_customers", "growth_intent"];
  } else if (s.repeat && !s.formal) {
    personaNumber = 3;
    fired = ["repeat_customers", "informal"];
  } else if (s.formalising || (s.formal && !s.repeat)) {
    personaNumber = 4;
    fired = s.formalising ? ["formalising"] : ["formal", "no_repeat_customers"];
  } else if (s.formal && s.repeat && !s.strongCapability) {
    personaNumber = 5;
    fired = ["formal", "repeat_customers", "stability_focus"];
  } else if (s.formal && s.repeat && s.strongCapability && !s.marketEvidence) {
    personaNumber = 7;
    fired = ["formal", "repeat_customers", "strong_capability", "limited_market"];
  } else if (s.formal && s.repeat && s.strongCapability && s.marketEvidence) {
    personaNumber = 8;
    fired = ["formal", "repeat_customers", "strong_capability", "market_evidence"];
  } else if (s.consistent) {
    personaNumber = s.formal ? 5 : 3;
    fired = s.formal ? ["consistent_revenue", "formal"] : ["consistent_revenue", "informal"];
  } else if (s.earns) {
    personaNumber = 2;
    fired = ["earns_money"];
  } else {
    personaNumber = 1;
    fired = ["no_income"];
  }

  return {
    personaNumber,
    personaName: PERSONA_NAMES[personaNumber],
    explanation: buildStageExplanation(personaNumber),
    stageSignals: fired,
  };
}

function buildStageExplanation(personaNumber: number): string {
  switch (personaNumber) {
    case 1:
      return "You're at the start of your journey — turning an idea or early activity into a repeatable business. The next step is to validate what you offer and learn what people will pay for.";
    case 2:
      return "You're earning money and you have customers, but the work still depends heavily on you and your income is inconsistent. Right now the question is whether you can make this repeatable.";
    case 3:
      return "You have repeat demand, which is real proof that something works. The question has shifted from 'can I make money from this?' to 'how do I make this work better?'";
    case 4:
      return "Your venture is becoming an institution — registration, accounts, and processes. Sithelo will help you build the compliance and credibility that unlocks larger opportunities.";
    case 5:
      return "Your business has reached reasonable stability, with predictable revenue and repeat customers. Your focus right now is keeping it stable and reliable.";
    case 6:
      return "Your business works and you've told us you want to grow. The key question now is what's holding you back — capital, market, skills, capacity, or something else.";
    case 7:
      return "You have the capability and compliance to pursue meaningful opportunities. Readiness is relative to each opportunity, so Sithelo will match you against what actually fits.";
    case 8:
      return "You have proven demand and the capability to serve a larger market. The practical barriers to reaching it — transport, logistics, geography, digital access — matter now.";
    case 9:
      return "Growth is already happening. The question is becoming 'can your organisation cope with growth?' — people, systems, capital and controls.";
    case 10:
      return "You're an established business considering your next strategic phase — investment, expansion, exports, procurement or partnerships.";
    default:
      return "Sithelo is building a picture of your business from what you've told us.";
  }
}

// --------------------------------------------------------------------
// Layer 2 — context dimensions
// --------------------------------------------------------------------

function deriveEconomicDependence(answers: AnswerMap): Level {
  let score = 0;
  const responsibility = str(answers, "b_financial_responsibility");
  if (responsibility === "household_primary" || responsibility === "extended_family") score += 0.6;
  else if (responsibility === "household_partial") score += 0.3;

  const employment = str(answers, "a_employment_status");
  if (employment === "unemployed" || employment === "retired") score += 0.4;
  else if (employment === "full_time_employed" || employment === "part_time_employed") score += 0.2;

  return levelFromScore(score);
}

function deriveHouseholdResponsibility(answers: AnswerMap): Level {
  let score = 0;
  const dependants = str(answers, "b_dependants");
  if (dependants === "3_plus") score += 0.4;
  else if (dependants === "1_2") score += 0.2;

  const children = str(answers, "b_children");
  if (children === "yes_primary") score += 0.3;
  else if (children === "yes_partial") score += 0.15;

  const caregiving = str(answers, "b_caregiving");
  if (caregiving === "significant") score += 0.3;
  else if (caregiving === "some") score += 0.15;

  return levelFromScore(score);
}

function deriveEmploymentAttachment(answers: AnswerMap): EmploymentAttachment {
  const employment = str(answers, "a_employment_status");
  switch (employment) {
    case "full_time_employed": return "full_time_employed";
    case "part_time_employed": return "part_time_employed";
    case "self_employed_full": return "self_employed_full";
    case "self_employed_part": return "self_employed_part";
    case "student": return "student";
    case "retired": return "retired";
    default: return "unemployed";
  }
}

function deriveTimeCapacity(answers: AnswerMap): Level {
  let score = 1;
  const employment = str(answers, "a_employment_status");
  if (employment === "full_time_employed") score -= 0.6;
  else if (employment === "part_time_employed") score -= 0.3;

  const children = str(answers, "b_children");
  if (children === "yes_primary") score -= 0.2;

  const caregiving = str(answers, "b_caregiving");
  if (caregiving === "significant") score -= 0.3;
  else if (caregiving === "some") score -= 0.15;

  return levelFromScore(Math.max(0, score));
}

function deriveCareResponsibilities(answers: AnswerMap): Level {
  let score = 0;
  const children = str(answers, "b_children");
  if (children === "yes_primary") score += 0.6;
  else if (children === "yes_partial") score += 0.3;

  const caregiving = str(answers, "b_caregiving");
  if (caregiving === "significant") score += 0.4;
  else if (caregiving === "some") score += 0.2;

  return levelFromScore(score);
}

function deriveFinancialResilience(answers: AnswerMap): Level {
  let score = 0.5;
  const savings = str(answers, "f_savings");
  if (savings === "three_months" || savings === "more") score += 0.3;
  else if (savings === "small") score += 0.15;
  else if (savings === "none") score -= 0.2;

  const debt = str(answers, "f_debt");
  if (debt === "heavy") score -= 0.3;
  else if (debt === "manageable") score -= 0.05;

  const pressure = str(answers, "b_financial_pressure");
  if (pressure === "high") score -= 0.15;
  else if (pressure === "low") score += 0.1;

  return levelFromScore(Math.max(0, Math.min(1, score)));
}

function deriveRiskCapacity(
  answers: AnswerMap,
  financialResilience: Level,
  householdResponsibility: Level,
  employmentAttachment: EmploymentAttachment
): Level {
  let score = 0.5;
  if (financialResilience === "high") score += 0.25;
  else if (financialResilience === "low") score -= 0.25;

  if (householdResponsibility === "high") score -= 0.25;
  else if (householdResponsibility === "low") score += 0.1;

  if (employmentAttachment === "full_time_employed") score -= 0.15;

  const householdDraw = str(answers, "f_business_money_for_household");
  if (householdDraw === "often") score -= 0.2;
  else if (householdDraw === "sometimes") score -= 0.1;

  const emergency = str(answers, "f_emergency_stopped_business");
  if (emergency === "yes_multiple") score -= 0.15;

  return levelFromScore(Math.max(0, Math.min(1, score)));
}

function deriveDigitalAccessibility(answers: AnswerMap): ContextDimensions["digitalAccessibility"] {
  const device = str(answers, "i_device");
  switch (device) {
    case "laptop": return "laptop";
    case "desktop": return "desktop";
    case "smartphone": return "smartphone";
    case "basic_phone": return "basic_phone";
    case "shared": return "shared";
    default: return "none";
  }
}

function deriveTransportAccessibility(answers: AnswerMap): Level {
  let score = 0.5;
  const method = str(answers, "i_transport_method");
  if (method === "own_vehicle") score += 0.3;
  else if (method === "public_transport") score -= 0.1;
  else if (method === "walking" || method === "lift") score -= 0.2;

  const time = str(answers, "i_travel_time");
  if (time === "over_60") score -= 0.3;
  else if (time === "30_60") score -= 0.1;

  const lost = str(answers, "i_transport_lost_opportunities");
  if (lost === "often") score -= 0.25;
  else if (lost === "sometimes") score -= 0.1;

  return levelFromScore(Math.max(0, Math.min(1, score)));
}

function deriveSupportPreference(answers: AnswerMap): string[] {
  const channels = multi(answers, "k_support_channels");
  if (channels.length > 0) return channels;

  // Fallback: infer a default from language + device.
  const preference: string[] = [];
  const device = str(answers, "i_device");
  if (device === "smartphone" || device === "basic_phone" || device === "shared") {
    preference.push("whatsapp");
  }
  preference.push("written");
  return preference;
}

function deriveSelfEfficacy(answers: AnswerMap): SelfEfficacy {
  const tasks: Record<string, number> = {};
  let sum = 0;
  let count = 0;
  for (const task of CAPABILITY_TASKS) {
    const c = confidence(answers, task.id);
    tasks[task.id] = c;
    sum += c;
    count += 1;
  }
  const overall = count > 0 ? Math.round((sum / count) * 10) / 10 : 1;
  return { overall, tasks };
}

function derivePerceivedControl(answers: AnswerMap): Level {
  let score = 0.5;
  const jobOffer = str(answers, "c_job_offer_scenario");
  if (jobOffer === "would_not_take") score += 0.3;
  else if (jobOffer === "only_if_business_fails") score += 0.15;
  else if (jobOffer === "take_immediately") score -= 0.2;

  const decision = str(answers, "h_decision_scenario");
  if (decision === "avoid") score -= 0.2;
  else if (decision === "decide_quickly") score += 0.1;

  const failure = str(answers, "h_failure_response");
  if (failure === "learn_try_again") score += 0.15;
  else if (failure === "discouraged") score -= 0.15;

  return levelFromScore(Math.max(0, Math.min(1, score)));
}

function deriveEntrepreneurialIdentity(answers: AnswerMap): Level {
  let score = 0.5;
  const identity = str(answers, "d_identity");
  if (identity === "entrepreneur_first") score += 0.4;
  else if (identity === "building_toward") score += 0.2;
  else if (identity === "supplement_income") score -= 0.15;
  else if (identity === "survival") score -= 0.1;

  const future = str(answers, "g_future_employment_status");
  if (future === "full_time_business") score += 0.2;

  const jobOffer = str(answers, "c_job_offer_scenario");
  if (jobOffer === "would_not_take") score += 0.2;
  else if (jobOffer === "take_immediately") score -= 0.2;

  return levelFromScore(Math.max(0, Math.min(1, score)));
}

function deriveGrowthAspiration(answers: AnswerMap): Level {
  let score = 0.5;
  const ambition = str(answers, "g_growth_ambition");
  if (ambition === "scale") score += 0.4;
  else if (ambition === "strong_growth") score += 0.3;
  else if (ambition === "modest_growth") score += 0.1;
  else if (ambition === "stability") score -= 0.2;

  const size = str(answers, "g_future_business_size");
  if (size === "large_organisation") score += 0.25;
  else if (size === "multiple_employees") score += 0.15;
  else if (size === "just_me") score -= 0.2;

  return levelFromScore(Math.max(0, Math.min(1, score)));
}

function deriveMotivation(answers: AnswerMap): Motivation {
  const reasons = multi(answers, "d_why_started");
  const identity = str(answers, "d_identity");
  const lifestyle = str(answers, "g_lifestyle_aspiration");

  if (reasons.includes("necessity") && !reasons.includes("opportunity") && !reasons.includes("passion")) {
    return "necessity";
  }
  if (reasons.includes("opportunity")) return "opportunity";
  if (reasons.includes("passion")) return "passion";
  if (reasons.includes("flexibility")) return "flexibility";
  if (reasons.includes("family")) return "family";
  if (reasons.includes("independence")) return "independence";
  if (identity === "survival" || lifestyle === "income") return "necessity";
  if (reasons.length > 1) return "mixed";
  return "necessity";
}

// --------------------------------------------------------------------
// Constraints, flags, gaps, strengths
// --------------------------------------------------------------------

function deriveConstraints(
  answers: AnswerMap,
  stage: JourneyStage,
  context: ContextDimensions,
  selfEfficacy: SelfEfficacy
): Constraint[] {
  const constraints: Constraint[] = [];

  const employment = str(answers, "a_employment_status");
  if (employment === "full_time_employed") {
    constraints.push({
      key: "weekday_attendance",
      label: "Weekday attendance",
      detail: "Full-time employment limits weekday, in-person participation.",
      severity: "high",
    });
  }

  const founderDep = str(answers, "e_business_dependency");
  if (founderDep === "no") {
    constraints.push({
      key: "founder_dependence",
      label: "Founder dependence",
      detail: "The business still depends on you personally day-to-day.",
      severity: context.timeCapacity === "low" ? "high" : "medium",
    });
  }

  if (context.transportAccessibility === "low") {
    constraints.push({
      key: "transport",
      label: "Transport",
      detail: "Transport cost and travel time limit in-person opportunities.",
      severity: "high",
    });
  }

  if (context.digitalAccessibility === "basic_phone" || context.digitalAccessibility === "none" || context.digitalAccessibility === "shared") {
    constraints.push({
      key: "digital_access",
      label: "Digital access",
      detail: "Limited or shared device access constrains online-heavy programmes.",
      severity: "medium",
    });
  }

  const householdDraw = str(answers, "f_business_money_for_household");
  if (householdDraw === "often" || householdDraw === "sometimes") {
    constraints.push({
      key: "cash_flow_pressure",
      label: "Cash flow pressure",
      detail: "Business money is regularly needed for household expenses.",
      severity: householdDraw === "often" ? "high" : "medium",
    });
  }

  if (selfEfficacy.tasks["j_record_keeping"] <= 2) {
    constraints.push({
      key: "record_keeping",
      label: "Record keeping",
      detail: "Low confidence keeping income and expense records.",
      severity: "medium",
    });
  }

  if (str(answers, "e_formalisation") === "informal" && stage.personaNumber >= 2) {
    constraints.push({
      key: "formalisation",
      label: "Not yet formal",
      detail: "The business is active but not formally registered.",
      severity: stage.personaNumber >= 4 ? "medium" : "low",
    });
  }

  if (context.careResponsibilities === "high") {
    constraints.push({
      key: "caregiving",
      label: "Caregiving",
      detail: "Caregiving responsibilities reduce available time.",
      severity: context.timeCapacity === "low" ? "high" : "medium",
    });
  }

  if (context.riskCapacity === "low") {
    constraints.push({
      key: "risk_capacity",
      label: "Risk capacity",
      detail: "Current circumstances leave little room for financial risk.",
      severity: "high",
    });
  }

  // Prioritise by severity.
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return constraints.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function deriveAccessFlags(answers: AnswerMap, context: ContextDimensions): AccessFlag[] {
  const flags: AccessFlag[] = [];

  if (["smartphone", "basic_phone", "shared"].includes(context.digitalAccessibility)) {
    flags.push({
      key: "mobile_first",
      label: "Mobile-first",
      detail: "Primarily uses a phone rather than a computer.",
    });
  }

  const dataReliability = str(answers, "i_data_reliability");
  if (dataReliability === "data_dependent" || dataReliability === "unreliable") {
    flags.push({
      key: "data_constrained",
      label: "Data constrained",
      detail: "Internet access depends on data availability or is unreliable.",
    });
  }

  if (context.transportAccessibility === "low") {
    flags.push({
      key: "transport_constrained",
      label: "Transport constrained",
      detail: "Transport is a significant barrier to in-person participation.",
    });
  }

  return flags;
}

function deriveCapabilityGaps(selfEfficacy: SelfEfficacy): CapabilityGap[] {
  return CAPABILITY_TASKS.filter((task) => selfEfficacy.tasks[task.id] <= 2).map((task) => ({
    key: task.id,
    label: task.label,
    confidence: selfEfficacy.tasks[task.id],
  }));
}

function deriveStrengths(
  answers: AnswerMap,
  stage: JourneyStage,
  selfEfficacy: SelfEfficacy
): string[] {
  const strengths: string[] = [];

  if (str(answers, "e_repeat_customers") === "mostly") strengths.push("Repeat customers");
  if (str(answers, "e_revenue_consistency") === "consistent") strengths.push("Consistent revenue");
  if (str(answers, "e_formalisation") === "formal") strengths.push("Formally registered");
  if (str(answers, "e_suppliers") === "established") strengths.push("Established supplier relationships");
  if (str(answers, "e_employees") === "5_plus") strengths.push("Creating jobs");

  const topSkills = CAPABILITY_TASKS.filter((t) => selfEfficacy.tasks[t.id] >= 4);
  if (topSkills.length >= 2) strengths.push(`Confident in: ${topSkills.slice(0, 2).map((t) => t.label.toLowerCase()).join(", ")}`);

  if (strengths.length === 0) strengths.push("Early-stage momentum");
  return strengths;
}

// --------------------------------------------------------------------
// Next moves + recommended opportunity characteristics
// --------------------------------------------------------------------

function deriveNextMoves(
  answers: AnswerMap,
  stage: JourneyStage,
  constraints: Constraint[],
  capabilityGaps: CapabilityGap[],
  context: ContextDimensions
): string[] {
  const moves: string[] = [];
  const constraintKeys = new Set(constraints.map((c) => c.key));
  const gapKeys = new Set(capabilityGaps.map((g) => g.key));

  if (str(answers, "f_money_separation") === "fully_mixed" || str(answers, "f_money_separation") === "partly_separate") {
    moves.push("Separate your personal and business cash flows — even a simple second account or a notebook split works.");
  }

  if (gapKeys.has("j_record_keeping") || stage.personaNumber >= 3) {
    moves.push("Prepare three months of basic sales and expense records.");
  }

  if (str(answers, "e_formalisation") === "informal" && stage.personaNumber >= 2) {
    moves.push("Complete your registration and supplier documentation when the time is right — it unlocks formal procurement.");
  }

  if (constraintKeys.has("weekday_attendance") || constraintKeys.has("transport")) {
    moves.push("Target programmes that offer evening, weekend or remote participation.");
  }

  if (constraintKeys.has("digital_access") || context.digitalAccessibility === "smartphone") {
    moves.push("Identify one reliable device and data plan for online applications.");
  }

  if (stage.personaNumber === 1) {
    moves.push("Test your offering with a few real customers before investing further.");
  }

  if (stage.personaNumber === 6 || stage.personaNumber === 9) {
    moves.push("Identify your single biggest bottleneck — capital, market, skills, capacity or compliance — and focus there first.");
  }

  if (moves.length === 0) {
    moves.push("Keep your Business Passport up to date so Sithelo can match you accurately.");
  }

  return moves.slice(0, 5);
}

function deriveRecommendedOpportunityCharacteristics(
  constraints: Constraint[],
  accessFlags: AccessFlag[],
  stage: JourneyStage,
  context: ContextDimensions
): string[] {
  const characteristics: string[] = [];
  const keys = new Set(constraints.map((c) => c.key));
  const flags = new Set(accessFlags.map((f) => f.key));

  if (keys.has("weekday_attendance") || context.timeCapacity === "low") {
    characteristics.push("Evening, weekend or flexible schedule");
  }
  if (flags.has("transport_constrained")) {
    characteristics.push("Remote or low-travel participation");
  }
  if (flags.has("mobile_first") || flags.has("data_constrained")) {
    characteristics.push("Mobile-friendly and light on data");
  }
  if (keys.has("risk_capacity") || context.riskCapacity === "low") {
    characteristics.push("Low or no upfront financial contribution");
  }
  if (stage.personaNumber <= 2) {
    characteristics.push("Welcomes pre-revenue or early-stage businesses");
  }
  if (context.riskCapacity !== "low") {
    characteristics.push("Matches your current capability level");
  }

  if (characteristics.length === 0) {
    characteristics.push("Matches your current stage and capability");
  }
  return characteristics;
}

// --------------------------------------------------------------------
// Public entry point
// --------------------------------------------------------------------

/**
 * Classify an entrepreneur's answers into a full two-layer journey profile.
 * Pure and deterministic — identical answers produce identical output.
 */
export function classifyJourney(answers: AnswerMap): JourneyProfile {
  const selfEfficacy = deriveSelfEfficacy(answers);
  const journey = determineJourneyStage(answers, selfEfficacy);

  const economicDependence = deriveEconomicDependence(answers);
  const householdResponsibility = deriveHouseholdResponsibility(answers);
  const employmentAttachment = deriveEmploymentAttachment(answers);
  const timeCapacity = deriveTimeCapacity(answers);
  const careResponsibilities = deriveCareResponsibilities(answers);
  const financialResilience = deriveFinancialResilience(answers);
  const riskCapacity = deriveRiskCapacity(answers, financialResilience, householdResponsibility, employmentAttachment);
  const digitalAccessibility = deriveDigitalAccessibility(answers);
  const transportAccessibility = deriveTransportAccessibility(answers);
  const supportPreference = deriveSupportPreference(answers);
  const perceivedControl = derivePerceivedControl(answers);
  const entrepreneurialIdentity = deriveEntrepreneurialIdentity(answers);
  const growthAspiration = deriveGrowthAspiration(answers);
  const motivation = deriveMotivation(answers);

  const context: ContextDimensions = {
    economicDependence,
    householdResponsibility,
    employmentAttachment,
    timeCapacity,
    careResponsibilities,
    financialResilience,
    riskCapacity,
    digitalAccessibility,
    transportAccessibility,
    supportPreference,
    selfEfficacy,
    perceivedControl,
    entrepreneurialIdentity,
    growthAspiration,
    motivation,
  };

  const constraints = deriveConstraints(answers, journey, context, selfEfficacy);
  const accessFlags = deriveAccessFlags(answers, context);
  const capabilityGaps = deriveCapabilityGaps(selfEfficacy);
  const strengths = deriveStrengths(answers, journey, selfEfficacy);
  const opportunityReadiness = computeOpportunityReadiness(answers, journey, context);
  const nextMoves = deriveNextMoves(answers, journey, constraints, capabilityGaps, context);
  const recommendedOpportunityCharacteristics = deriveRecommendedOpportunityCharacteristics(
    constraints, accessFlags, journey, context
  );

  return {
    frameworkVersion: FRAMEWORK_VERSION,
    journey,
    context,
    constraints,
    accessFlags,
    capabilityGaps,
    strengths,
    opportunityReadiness,
    recommendedOpportunityCharacteristics,
    nextMoves,
  };
}
