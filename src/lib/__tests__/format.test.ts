import { describe, expect, it } from "vitest";
import { formatRand, humanize } from "../format";

describe("formatRand", () => {
  it("picks a sensible unit instead of always using millions", () => {
    expect(formatRand(850)).toBe("R850");
    expect(formatRand(45_000)).toBe("R45k");
    expect(formatRand(100_000)).toBe("R100k");
    expect(formatRand(1_200_000)).toBe("R1.2M");
    expect(formatRand(3_000_000)).toBe("R3M");
    expect(formatRand(3_400_000_000)).toBe("R3.4bn");
  });

  it("handles numeric strings and missing values", () => {
    expect(formatRand("250000")).toBe("R250k");
    expect(formatRand(null)).toBe("—");
    expect(formatRand("not a number")).toBe("—");
  });
});

describe("humanize", () => {
  it("turns enum values into sentence case", () => {
    expect(humanize("under_review")).toBe("Under review");
  });
});
