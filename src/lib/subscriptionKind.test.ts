import { describe, expect, it } from "vitest";
import {
  accountPageFilterMatches,
  accountPaymentStatus,
  isFreeAccount,
  isPaidSubscription,
} from "./subscriptionKind";

describe("subscriptionKind", () => {
  it("classifies payment status", () => {
    expect(accountPaymentStatus({ billing_model: "free_account" })).toBe("free");
    expect(accountPaymentStatus({ billing_model: "recurring" })).toBe("recurring");
    expect(accountPaymentStatus({ billing_model: "one_time" })).toBe("one_time");
  });

  it("filters accounts page tabs", () => {
    const free = { billing_model: "free_account" as const };
    const paid = { billing_model: "recurring" as const };
    expect(accountPageFilterMatches(free, "all")).toBe(true);
    expect(accountPageFilterMatches(paid, "all")).toBe(true);
    expect(accountPageFilterMatches(free, "free")).toBe(true);
    expect(accountPageFilterMatches(paid, "free")).toBe(false);
    expect(accountPageFilterMatches(paid, "paid")).toBe(true);
    expect(accountPageFilterMatches(free, "paid")).toBe(false);
  });

  it("isFreeAccount vs isPaidSubscription are mutually exclusive", () => {
    expect(isFreeAccount({ billing_model: "free_account" })).toBe(true);
    expect(isPaidSubscription({ billing_model: "free_account" })).toBe(false);
    expect(isPaidSubscription({ billing_model: "one_time" })).toBe(true);
  });
});
