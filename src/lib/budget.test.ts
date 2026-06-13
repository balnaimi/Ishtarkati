import { describe, expect, it } from "vitest";
import { computeBudgetStatus, parseBudgetLimit } from "./budget";

describe("parseBudgetLimit", () => {
  it("parses positive numbers", () => {
    expect(parseBudgetLimit("500")).toBe(500);
    expect(parseBudgetLimit("  12.5 ")).toBe(12.5);
  });

  it("returns null for empty or invalid", () => {
    expect(parseBudgetLimit("")).toBeNull();
    expect(parseBudgetLimit("abc")).toBeNull();
    expect(parseBudgetLimit("0")).toBeNull();
  });
});

describe("computeBudgetStatus", () => {
  it("disabled when no limit", () => {
    const s = computeBudgetStatus(100, null);
    expect(s.enabled).toBe(false);
    expect(s.over).toBe(false);
  });

  it("detects over budget", () => {
    const s = computeBudgetStatus(120, "100");
    expect(s.enabled).toBe(true);
    expect(s.over).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it("computes remaining", () => {
    const s = computeBudgetStatus(40, "100");
    expect(s.remaining).toBe(60);
    expect(s.pct).toBe(40);
  });
});
