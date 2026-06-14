import { describe, expect, it } from "vitest";
import {
  intervalToApproxMonths,
  subscriptionMonthlyEquivalentPrimary,
  sumMonthlyEquivalentPrimary,
} from "./schedule";

describe("subscriptionMonthlyEquivalentPrimary", () => {
  it("normalizes yearly and quarterly recurring amounts to monthly", () => {
    expect(
      subscriptionMonthlyEquivalentPrimary({
        billing_model: "recurring",
        interval_unit: "year",
        interval_count: 1,
        amount_qar_snapshot: 120,
      }),
    ).toBe(10);
    expect(
      subscriptionMonthlyEquivalentPrimary({
        billing_model: "recurring",
        interval_unit: "month",
        interval_count: 3,
        amount_qar_snapshot: 30,
      }),
    ).toBe(10);
    expect(
      subscriptionMonthlyEquivalentPrimary({
        billing_model: "recurring",
        interval_unit: "month",
        interval_count: 1,
        amount_qar_snapshot: 15,
      }),
    ).toBe(15);
  });

  it("excludes free and one-time subscriptions", () => {
    expect(
      subscriptionMonthlyEquivalentPrimary({
        billing_model: "free_account",
        interval_unit: null,
        interval_count: 1,
        amount_qar_snapshot: 0,
      }),
    ).toBe(0);
    expect(
      subscriptionMonthlyEquivalentPrimary({
        billing_model: "one_time",
        interval_unit: null,
        interval_count: 1,
        amount_qar_snapshot: 99,
      }),
    ).toBe(0);
  });

  it("sums visible recurring rows", () => {
    const total = sumMonthlyEquivalentPrimary([
      {
        billing_model: "recurring",
        interval_unit: "year",
        interval_count: 1,
        amount_qar_snapshot: 120,
      },
      {
        billing_model: "recurring",
        interval_unit: "month",
        interval_count: 1,
        amount_qar_snapshot: 25,
      },
      {
        billing_model: "one_time",
        interval_unit: null,
        interval_count: 1,
        amount_qar_snapshot: 200,
      },
    ]);
    expect(total).toBe(35);
  });
});

describe("intervalToApproxMonths", () => {
  it("covers common billing units", () => {
    expect(intervalToApproxMonths("year", 1)).toBe(12);
    expect(intervalToApproxMonths("month", 2)).toBe(2);
    expect(intervalToApproxMonths("week", 4)).toBeCloseTo((4 * 7) / 30);
  });
});
