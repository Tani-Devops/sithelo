import { describe, expect, it } from "vitest";
import { safeNextPath } from "../auth/safeNext";

describe("safeNextPath", () => {
  it("keeps same-origin paths, including query and hash", () => {
    expect(safeNextPath("/entrepreneur/dashboard")).toBe("/entrepreneur/dashboard");
    expect(safeNextPath("/institution/applications?status=submitted#top")).toBe(
      "/institution/applications?status=submitted#top"
    );
  });

  it("rejects missing, relative and absolute values", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("dashboard")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
  });

  it("rejects values a browser would resolve to another origin", () => {
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("/\t/evil.com")).toBeNull();
    expect(safeNextPath("/\n/evil.com")).toBeNull();
  });
});
