// ====================================================================
// Ecosystem insights tests — never display fake statistics.
// ====================================================================
import { describe, expect, it } from "vitest";
import { computeEcosystemInsights, MIN_SAMPLE_SIZE, type SnapshotSummary } from "../ecosystem/insights";

function row(overrides: Partial<SnapshotSummary> = {}): SnapshotSummary {
  return {
    personaName: "Builder",
    employmentAttachment: "self_employed_full",
    digitalAccessibility: "smartphone",
    transportAccessibility: "medium",
    riskCapacity: "medium",
    supportPreference: ["whatsapp"],
    constraintKeys: [],
    ...overrides,
  };
}

describe("computeEcosystemInsights", () => {
  it("returns null when there is insufficient data", () => {
    const rows = Array.from({ length: MIN_SAMPLE_SIZE - 1 }, () => row());
    expect(computeEcosystemInsights(rows)).toBeNull();
  });

  it("returns insights only once the minimum sample size is met", () => {
    const rows = Array.from({ length: MIN_SAMPLE_SIZE }, () => row());
    const insights = computeEcosystemInsights(rows);
    expect(insights).not.toBeNull();
    expect(insights!.length).toBeGreaterThan(0);
    // 0 of 10 are full-time employed in this sample.
    const employment = insights!.find((i) => i.label === "In full-time employment");
    expect(employment?.value).toBe("0%");
  });

  it("computes percentages from real counts", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row({ employmentAttachment: "full_time_employed" })),
      ...Array.from({ length: 5 }, () => row()),
    ];
    const insights = computeEcosystemInsights(rows)!;
    const employment = insights.find((i) => i.label === "In full-time employment");
    expect(employment?.value).toBe("50%");
  });

  it("never returns metrics for an empty sample", () => {
    expect(computeEcosystemInsights([])).toBeNull();
  });
});
