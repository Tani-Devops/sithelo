// ====================================================================
// Shared test fixtures for the classification and matching engines.
//
// The two canonical entrepreneurs from directive §23:
//   A — R12,000/month, 20 customers, informal, 25, no dependants, no
//       employment, full-time business capacity, high commitment.
//   B — R12,000/month, 20 customers, informal, 36, dependants, full-time
//       employment, evening/weekend business, cannot risk salary, limited
//       data, WhatsApp preference.
//
// Their BUSINESS STAGE is similar; their CONTEXT differs substantially.
// ====================================================================

import type { AnswerMap } from "../assessment/types";
import { classifyJourney } from "../classification/classify";
import type { MatchableEntrepreneur, BusinessFacts } from "../matching/score";

export const entrepreneurA: AnswerMap = {
  a_age_band: "25_34",
  a_employment_status: "self_employed_full",
  a_preferred_language: "english",
  a_education: "matric",
  b_dependants: "none",
  b_children: "none",
  b_caregiving: "none",
  b_financial_responsibility: "self_only",
  b_financial_pressure: "low",
  c_job_offer_scenario: "would_not_take",
  d_identity: "entrepreneur_first",
  d_why_started: ["opportunity", "passion"],
  d_experience: "1_3yr",
  e_earns_money: true,
  e_formalisation: "informal",
  e_customers: "steady",
  e_repeat_customers: "mostly",
  e_revenue_consistency: "consistent",
  e_employees: "none",
  e_suppliers: "informal",
  e_business_dependency: "no",
  f_business_income_range: "10k_25k",
  f_money_separation: "partly_separate",
  f_business_money_for_household: "never",
  f_emergency_stopped_business: "no",
  f_savings: "small",
  f_debt: "none",
  g_growth_ambition: "strong_growth",
  g_future_business_size: "small_team",
  g_future_income: "25k_50k",
  g_future_employment_status: "full_time_business",
  g_lifestyle_aspiration: "growth",
  h_decision_scenario: "decide_quickly",
  h_uncertainty_scenario: "try_it",
  h_failure_response: "learn_try_again",
  h_family_influence: "not_much",
  h_support_network: "peers",
  h_willingness_to_invest: "invest_growth",
  h_experiment_vs_commit: "experiment",
  i_device: "smartphone",
  i_data_reliability: "mostly",
  i_digital_capabilities: ["whatsapp", "email", "banking"],
  i_transport_method: "own_vehicle",
  i_travel_time: "under_30",
  i_transport_lost_opportunities: "no",
  j_finding_customers: 4,
  j_setting_prices: 3,
  j_selling: 4,
  j_managing_cash: 3,
  j_record_keeping: 3,
  j_applying_funding: 2,
  j_formal_documents: 3,
  j_negotiation: 3,
  j_managing_employees: 2,
  j_digital_tools: 3,
  j_planning_growth: 3,
  k_support_channels: ["whatsapp", "coaching"],
  l_interested_classes: ["funding", "markets"],
};

export const entrepreneurB: AnswerMap = {
  a_age_band: "35_44",
  a_employment_status: "full_time_employed",
  a_preferred_language: "isizulu",
  a_education: "some_secondary",
  b_dependants: "3_plus",
  b_children: "yes_primary",
  b_caregiving: "some",
  b_financial_responsibility: "household_primary",
  b_financial_pressure: "high",
  c_income_dependence: "fully_dependent",
  c_job_security: "fairly_secure",
  c_income_threshold: "about_salary",
  c_job_offer_scenario: "only_if_business_fails",
  d_identity: "building_toward",
  d_why_started: ["necessity", "family"],
  d_experience: "1_3yr",
  e_earns_money: true,
  e_formalisation: "informal",
  e_customers: "steady",
  e_repeat_customers: "mostly",
  e_revenue_consistency: "seasonal",
  e_employees: "none",
  e_suppliers: "informal",
  e_business_dependency: "no",
  f_business_income_range: "10k_25k",
  f_money_separation: "fully_mixed",
  f_business_money_for_household: "often",
  f_emergency_stopped_business: "yes_once",
  f_savings: "none",
  f_debt: "manageable",
  g_growth_ambition: "strong_growth",
  g_future_business_size: "just_me",
  g_future_income: "10k_25k",
  g_future_employment_status: "still_employed",
  g_lifestyle_aspiration: "family_security",
  h_decision_scenario: "ask_others",
  h_uncertainty_scenario: "decline",
  h_failure_response: "discouraged",
  h_family_influence: "a_lot",
  h_support_network: "informal",
  h_willingness_to_invest: "save",
  h_experiment_vs_commit: "depends",
  i_device: "smartphone",
  i_data_reliability: "data_dependent",
  i_digital_capabilities: ["whatsapp"],
  i_transport_method: "public_transport",
  i_travel_time: "30_60",
  i_transport_lost_opportunities: "sometimes",
  j_finding_customers: 4,
  j_setting_prices: 3,
  j_selling: 4,
  j_managing_cash: 2,
  j_record_keeping: 2,
  j_applying_funding: 1,
  j_formal_documents: 2,
  j_negotiation: 3,
  j_managing_employees: 2,
  j_digital_tools: 2,
  j_planning_growth: 2,
  k_support_channels: ["whatsapp"],
  l_interested_classes: ["funding", "training"],
};

export const starterAnswers: AnswerMap = {
  a_employment_status: "unemployed",
  b_dependants: "none",
  b_children: "none",
  b_caregiving: "none",
  b_financial_responsibility: "self_only",
  b_financial_pressure: "medium",
  c_job_offer_scenario: "would_not_take",
  d_identity: "building_toward",
  d_why_started: ["opportunity"],
  e_earns_money: false,
  e_formalisation: "informal",
  e_products_services: "Catering",
  g_growth_ambition: "strong_growth",
  g_future_business_size: "small_team",
  g_future_income: "10k_25k",
  g_future_employment_status: "full_time_business",
  i_device: "smartphone",
  i_data_reliability: "mostly",
  i_digital_capabilities: ["whatsapp"],
  i_transport_method: "public_transport",
  i_travel_time: "under_30",
  i_transport_lost_opportunities: "no",
  k_support_channels: ["whatsapp"],
  l_interested_classes: ["training", "incubation"],
};

function defaultBusinessFacts(overrides: Partial<BusinessFacts> = {}): BusinessFacts {
  return {
    formalised: false,
    revenueMonthly: 17500,
    yearsTrading: 2,
    employees: 0,
    trustScore: 40,
    bbbeeLevel: null,
    verifiedCompliance: [],
    industry: "Catering",
    ...overrides,
  };
}

/** Build a MatchableEntrepreneur from raw answers + business facts. */
export function toMatchable(
  answers: AnswerMap,
  factsOverrides: Partial<BusinessFacts> = {}
): MatchableEntrepreneur {
  return {
    profile: classifyJourney(answers),
    answers,
    business: defaultBusinessFacts(factsOverrides),
  };
}
