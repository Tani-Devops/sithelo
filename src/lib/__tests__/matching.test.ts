// ====================================================================
// Matching engine tests — eligibility vs business fit vs practical fit
// vs readiness vs friction (never conflated).
// ====================================================================
import { describe, expect, it } from "vitest";
import {
  scoreOpportunity,
  readinessAgainstOpportunity,
  type Requirement,
} from "../matching/score";
import { entrepreneurA, entrepreneurB, toMatchable } from "./fixtures";

const r = (key: string, value: string | number | boolean, category: Requirement["category"] = "readiness"): Requirement => ({
  key,
  value,
  category,
});

describe("scoreOpportunity — eligibility", () => {
  it("marks an informal entrepreneur ineligible when CIPC registration is required", () => {
    const ent = toMatchable(entrepreneurA, { formalised: false });
    const result = scoreOpportunity([r("cipc_required", true, "eligibility")], ent);
    expect(result.eligibility).toBe("ineligible");
    expect(result.matchScore).toBe(0);
    expect(result.eligibilityReasons.length).toBeGreaterThan(0);
  });

  it("marks a formal entrepreneur eligible when CIPC registration is required", () => {
    const ent = toMatchable(entrepreneurA, { formalised: true });
    const result = scoreOpportunity([r("cipc_required", true, "eligibility")], ent);
    expect(result.eligibility).toBe("eligible");
  });
});

describe("scoreOpportunity — practical fit + friction", () => {
  it("reports high practical fit when requirements are frictionless", () => {
    const ent = toMatchable(entrepreneurA);
    const result = scoreOpportunity(
      [r("schedule", "flexible", "practical_fit"), r("delivery", "online", "practical_fit")],
      ent
    );
    expect(result.eligibility).toBe("eligible");
    expect(result.friction).toHaveLength(0);
    expect(result.practicalFit).toBe(100);
  });

  it("reports friction for weekday + physical + laptop for an employed, mobile-first entrepreneur", () => {
    const ent = toMatchable(entrepreneurB);
    const result = scoreOpportunity(
      [
        r("schedule", "weekday", "practical_fit"),
        r("delivery", "physical", "practical_fit"),
        r("device_required", "laptop", "practical_fit"),
      ],
      ent
    );
    expect(result.eligibility).toBe("eligible");
    const frictionKeys = result.friction.map((f) => f.key);
    expect(frictionKeys).toContain("schedule");
    expect(frictionKeys).toContain("travel");
    expect(frictionKeys).toContain("device");
    expect(result.practicalFit).toBeLessThan(100);
  });
});

describe("scoreOpportunity — practical friction does NOT hide the opportunity", () => {
  it("still shows a positive match score despite friction", () => {
    const ent = toMatchable(entrepreneurB);
    const result = scoreOpportunity(
      [r("schedule", "weekday", "practical_fit"), r("delivery", "physical", "practical_fit")],
      ent
    );
    expect(result.eligibility).toBe("eligible");
    expect(result.matchScore).toBeGreaterThan(0);
    expect(result.explanation).toMatch(/friction/i);
  });
});

describe("readinessAgainstOpportunity — opportunity-specific", () => {
  it("gives a formal entrepreneur higher procurement readiness than an informal one", () => {
    const informal = toMatchable(entrepreneurA, { formalised: false });
    const formal = toMatchable(entrepreneurA, { formalised: true });
    const reqs: Requirement[] = [r("procurement_required", true, "readiness"), r("capacity_required", true, "readiness")];

    const informalReadiness = readinessAgainstOpportunity(reqs, informal);
    const formalReadiness = readinessAgainstOpportunity(reqs, formal);

    expect(formalReadiness).toBeGreaterThan(informalReadiness);
  });

  it("distinguishes stage fit from access fit", () => {
    const ent = toMatchable(entrepreneurB);
    const result = scoreOpportunity(
      [r("stage_min", 6, "readiness"), r("delivery", "physical", "practical_fit")],
      ent
    );
    // Stage is a fit (persona 6 >= stage_min 6), but physical delivery is friction.
    expect(result.businessFit).toBeGreaterThanOrEqual(50);
    expect(result.friction.map((f) => f.key)).toContain("travel");
  });
});
