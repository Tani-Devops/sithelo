// ====================================================================
// Opportunity requirement taxonomy + server-side reader.
// Single source of truth for the structured requirement keys used by the
// provider creation flow and the matching engine.
// ====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Requirement, RequirementCategory } from "./score";

export interface RequirementField {
  key: string;
  category: RequirementCategory;
  label: string;
  valueType: "boolean" | "number" | "choice";
  options?: { value: string; label: string }[];
  /** Hint shown to the provider. */
  hint?: string;
}

/** The requirement taxonomy the provider creation form renders. */
export const REQUIREMENT_FIELDS: RequirementField[] = [
  // ---- Practical fit (how the opportunity is delivered) ----
  { key: "schedule", category: "practical_fit", label: "Schedule", valueType: "choice", options: [
    { value: "weekday", label: "Weekday" },
    { value: "evening", label: "Evening" },
    { value: "weekend", label: "Weekend" },
    { value: "flexible", label: "Flexible" },
  ], hint: "When participation is required." },
  { key: "delivery", category: "practical_fit", label: "Delivery", valueType: "choice", options: [
    { value: "online", label: "Online" },
    { value: "hybrid", label: "Hybrid" },
    { value: "physical", label: "In person" },
  ] },
  { key: "hours_per_week", category: "practical_fit", label: "Hours per week", valueType: "number", hint: "Approximate weekly time commitment." },
  { key: "duration_weeks", category: "practical_fit", label: "Duration (weeks)", valueType: "number" },
  { key: "device_required", category: "practical_fit", label: "Device required", valueType: "choice", options: [
    { value: "smartphone", label: "Smartphone" },
    { value: "laptop", label: "Laptop" },
  ] },
  { key: "travel_required", category: "practical_fit", label: "Travel required", valueType: "boolean" },
  { key: "participant_contribution", category: "practical_fit", label: "Participant contribution (R)", valueType: "number", hint: "0 if free." },
  { key: "data_required", category: "practical_fit", label: "Significant data use required", valueType: "boolean" },

  // ---- Readiness (what the business must be able to do) ----
  { key: "stage_min", category: "readiness", label: "Minimum journey stage", valueType: "number", hint: "1 (Starter) to 10 (Strategic Enterprise)." },
  { key: "revenue_threshold", category: "readiness", label: "Minimum monthly revenue (R)", valueType: "number" },
  { key: "capacity_required", category: "readiness", label: "Delivery capacity required", valueType: "boolean" },
  { key: "staffing_required", category: "readiness", label: "Staff/team required", valueType: "boolean" },
  { key: "funding_required", category: "readiness", label: "Funding-readiness required", valueType: "boolean" },
  { key: "procurement_required", category: "readiness", label: "Procurement-readiness required", valueType: "boolean" },

  // ---- Eligibility (hard gates) ----
  { key: "cipc_required", category: "eligibility", label: "CIPC registration required", valueType: "boolean" },
  { key: "vat_required", category: "eligibility", label: "VAT registration required", valueType: "boolean" },
  { key: "sars_required", category: "eligibility", label: "SARS tax clearance required", valueType: "boolean" },
  { key: "min_years_trading", category: "eligibility", label: "Minimum years trading", valueType: "number" },
];

/** Read the structured requirements for an opportunity. */
export async function readOpportunityRequirements(
  supabase: SupabaseClient,
  opportunityId: string
): Promise<Requirement[]> {
  const { data } = await supabase
    .from("opportunity_requirements")
    .select("requirement_key, requirement_value, category, label")
    .eq("opportunity_id", opportunityId);

  return (data ?? []).map((row: { requirement_key: string; requirement_value: unknown; category: string; label: string | null }) => ({
    key: row.requirement_key,
    value: row.requirement_value as string | number | boolean,
    category: row.category as RequirementCategory,
    label: row.label ?? undefined,
  }));
}
