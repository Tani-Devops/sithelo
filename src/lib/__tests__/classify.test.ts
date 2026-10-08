// ====================================================================
// Classification engine tests — the two-layer journey classifier.
// ====================================================================
import { describe, expect, it } from "vitest";
import { classifyJourney } from "../classification/classify";
import { entrepreneurA, entrepreneurB, starterAnswers } from "./fixtures";

describe("classifyJourney — journey stage (Layer 1)", () => {
  it("recognises a Starter when the business earns nothing yet", () => {
    const profile = classifyJourney(starterAnswers);
    expect(profile.journey.personaNumber).toBe(1);
    expect(profile.journey.personaName).toBe("Starter");
  });

  it("assigns entrepreneur A (full-time entrepreneur) to Growth Seeker", () => {
    const profile = classifyJourney(entrepreneurA);
    expect(profile.journey.personaName).toBe("Growth Seeker");
  });

  it("assigns entrepreneur B (employed, dependants) to Growth Seeker too — similar stage", () => {
    const profile = classifyJourney(entrepreneurB);
    expect(profile.journey.personaName).toBe("Growth Seeker");
  });
});

describe("classifyJourney — context dimensions (Layer 2)", () => {
  it("gives A and B the SAME stage but DIFFERENT context", () => {
    const a = classifyJourney(entrepreneurA);
    const b = classifyJourney(entrepreneurB);

    // Same stage.
    expect(a.journey.personaNumber).toBe(b.journey.personaNumber);

    // Different context.
    expect(a.context.timeCapacity).toBe("high");
    expect(b.context.timeCapacity).toBe("low");

    expect(a.context.householdResponsibility).toBe("low");
    expect(b.context.householdResponsibility).toBe("high");

    expect(a.context.riskCapacity).toBe("high");
    expect(b.context.riskCapacity).toBe("low");

    expect(a.context.employmentAttachment).toBe("self_employed_full");
    expect(b.context.employmentAttachment).toBe("full_time_employed");
  });

  it("flags B as mobile-first and data-constrained, but not A", () => {
    const a = classifyJourney(entrepreneurA);
    const b = classifyJourney(entrepreneurB);

    const aFlags = a.accessFlags.map((f) => f.key);
    const bFlags = b.accessFlags.map((f) => f.key);

    expect(aFlags).not.toContain("data_constrained");
    expect(bFlags).toContain("data_constrained");
    expect(bFlags).toContain("mobile_first");
  });

  it("surfaces a weekday-attendance constraint for B (employed), not for A", () => {
    const a = classifyJourney(entrepreneurA);
    const b = classifyJourney(entrepreneurB);

    expect(a.constraints.map((c) => c.key)).not.toContain("weekday_attendance");
    expect(b.constraints.map((c) => c.key)).toContain("weekday_attendance");
  });

  it("produces different recommended opportunity characteristics for A and B", () => {
    const a = classifyJourney(entrepreneurA);
    const b = classifyJourney(entrepreneurB);

    const aChars = a.recommendedOpportunityCharacteristics;
    const bChars = b.recommendedOpportunityCharacteristics;

    // B needs flexibility + low contribution; A does not.
    expect(bChars.join(" ")).toMatch(/flexible|evening|weekend/i);
    expect(bChars.join(" ")).toMatch(/low or no upfront|contribution/i);
    expect(aChars.join(" ")).not.toMatch(/weekday|evening|weekend|flexible/i);
  });
});

describe("classifyJourney — readiness is contextual (never a single %)", () => {
  it("returns per-class readiness tiers, not one global score", () => {
    const profile = classifyJourney(entrepreneurA);
    const r = profile.opportunityReadiness;
    expect(r).toHaveProperty("funding");
    expect(r).toHaveProperty("procurement");
    expect(r).toHaveProperty("investment");
    expect(r).toHaveProperty("market");
    expect(["early", "developing", "moderate", "strong"]).toContain(r.funding);
  });

  it("gives A (informal, no records confidence) developing/early funding readiness", () => {
    const profile = classifyJourney(entrepreneurA);
    // Informal + low record-keeping confidence => not "strong" funding readiness.
    expect(profile.opportunityReadiness.funding).not.toBe("strong");
  });
});

describe("classifyJourney — never labels permanently", () => {
  it("produces a traceable, deterministic profile every time", () => {
    const first = classifyJourney(entrepreneurA);
    const second = classifyJourney(entrepreneurA);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.journey.stageSignals.length).toBeGreaterThan(0);
  });

  it("outputs next moves as concrete, actionable steps", () => {
    const profile = classifyJourney(entrepreneurB);
    expect(profile.nextMoves.length).toBeGreaterThanOrEqual(3);
    expect(profile.nextMoves.length).toBeLessThanOrEqual(5);
  });
});
