// ====================================================================
// Ecosystem intelligence — aggregated, ANONYMISED insights.
//
// CRITICAL (directive §13): never display fake statistics. This module
// returns null (=> "Insufficient data") until enough real assessment
// snapshots exist. No metric is ever seeded.
// ====================================================================

/** Minimum real snapshots before any aggregate is shown. */
export const MIN_SAMPLE_SIZE = 10;

export interface SnapshotSummary {
  personaName: string | null;
  employmentAttachment: string | null;
  digitalAccessibility: string | null;
  transportAccessibility: string | null;
  riskCapacity: string | null;
  supportPreference: string[];
  constraintKeys: string[];
}

export interface EcosystemInsight {
  label: string;
  value: string;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

/**
 * Compute anonymised ecosystem insights from real snapshots.
 * Returns null when there is insufficient data (fewer than MIN_SAMPLE_SIZE).
 */
export function computeEcosystemInsights(rows: SnapshotSummary[]): EcosystemInsight[] | null {
  if (rows.length < MIN_SAMPLE_SIZE) return null;

  const total = rows.length;
  const fullTimeEmployed = rows.filter((r) => r.employmentAttachment === "full_time_employed").length;
  const mobileOnly = rows.filter(
    (r) => ["smartphone", "basic_phone", "shared", "none"].includes(r.digitalAccessibility ?? "")
  ).length;
  const transportConstrained = rows.filter((r) => r.transportAccessibility === "low").length;
  const lowRiskCapacity = rows.filter((r) => r.riskCapacity === "low").length;
  const weekdayConstrained = rows.filter((r) => r.constraintKeys.includes("weekday_attendance")).length;

  const stageCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.personaName) stageCounts.set(r.personaName, (stageCounts.get(r.personaName) ?? 0) + 1);
  }
  const topStage = [...stageCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const channelCounts = new Map<string, number>();
  for (const r of rows) {
    for (const c of r.supportPreference) {
      channelCounts.set(c, (channelCounts.get(c) ?? 0) + 1);
    }
  }
  const topChannel = [...channelCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    { label: "Assessments completed", value: String(total) },
    { label: "In full-time employment", value: pct(fullTimeEmployed, total) },
    { label: "Mobile-only access", value: pct(mobileOnly, total) },
    { label: "Transport constrained", value: pct(transportConstrained, total) },
    { label: "Low risk capacity", value: pct(lowRiskCapacity, total) },
    { label: "Weekday attendance constraint", value: pct(weekdayConstrained, total) },
    { label: "Most common journey stage", value: topStage ? `${topStage[0]} (${topStage[1]})` : "—" },
    { label: "Preferred support channel", value: topChannel ? topChannel[0].replace(/_/g, " ") : "—" },
  ];
}
