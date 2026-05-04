import { addMonths, addYears, formatISO, parseISO, isValid } from "date-fns";
import type { IntervalUnit } from "../types";

/** Resolve billing interval to a number of months. */
export function intervalToMonths(
  unit: IntervalUnit | null | undefined,
  customMonths: number | null | undefined,
): number {
  if (!unit) return 0;
  switch (unit) {
    case "month":
      return 1;
    case "quarter":
      return 3;
    case "year":
      return 12;
    case "custom_months":
      return Math.max(1, customMonths ?? 1);
    default:
      return 0;
  }
}

export function addBillingInterval(
  from: Date,
  unit: IntervalUnit | null,
  customMonths: number | null,
): Date {
  const m = intervalToMonths(unit, customMonths);
  if (m <= 0) return from;
  return addMonths(from, m);
}

export function formatDateInput(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export function parseDateInput(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = parseISO(s.trim());
  return isValid(d) ? d : null;
}

export function advanceNextDueAfterRenewal(
  previousNext: string | null,
  renewalYears: number,
  paidAt: Date,
): string {
  const base = previousNext
    ? parseDateInput(previousNext)
    : null;
  const start = base ?? paidAt;
  const next = addYears(start, Math.max(1, renewalYears));
  return formatDateInput(next);
}
