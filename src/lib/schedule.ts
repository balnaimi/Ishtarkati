import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  formatISO,
  parseISO,
  isValid,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import type { IntervalUnit } from "../types";

/** Advance by one billing period (count × unit). */
export function addBillingSteps(
  from: Date,
  unit: IntervalUnit | null,
  count: number,
): Date {
  const n = Math.max(1, count || 1);
  if (!unit) return from;
  switch (unit) {
    case "day":
      return addDays(from, n);
    case "week":
      return addWeeks(from, n);
    case "month":
      return addMonths(from, n);
    case "year":
      return addYears(from, n);
    default:
      return from;
  }
}

/** Step backward from next due to estimate period start. */
export function subtractBillingSteps(end: Date, unit: IntervalUnit, count: number): Date {
  const n = Math.max(1, count || 1);
  switch (unit) {
    case "day":
      return subDays(end, n);
    case "week":
      return subWeeks(end, n);
    case "month":
      return subMonths(end, n);
    case "year":
      return subYears(end, n);
    default:
      return end;
  }
}

/** Approximate length of one period in months (for monthly-equivalent stats). */
export function intervalToApproxMonths(unit: IntervalUnit | null, count: number): number {
  const c = Math.max(1, count || 1);
  if (!unit) return 0;
  switch (unit) {
    case "day":
      return c / 30;
    case "week":
      return (c * 7) / 30;
    case "month":
      return c;
    case "year":
      return c * 12;
    default:
      return 0;
  }
}

export function formatDateInput(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export function parseDateInput(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = parseISO(s.trim());
  return isValid(d) ? d : null;
}

/** Payment anniversaries from `anchorDay` onward, spaced by billing, each ≤ `untilDay` inclusive. */
export function listPaymentDatesThrough(
  anchorDay: string,
  untilDay: string,
  unit: IntervalUnit | null,
  count: number,
): string[] {
  const until = parseDateInput(untilDay);
  let cur = parseDateInput(anchorDay);
  if (!until || !cur || cur > until || !unit) return [];
  const n = Math.max(1, count || 1);
  const isoList: string[] = [];
  while (cur <= until) {
    isoList.push(formatDateInput(cur));
    cur = addBillingSteps(cur, unit, n);
  }
  return isoList;
}

export function advanceNextDueAfterRenewal(
  previousNext: string | null,
  renewalYears: number,
  paidAt: Date,
): string {
  const base = previousNext ? parseDateInput(previousNext) : null;
  const start = base ?? paidAt;
  const next = addYears(start, Math.max(1, renewalYears));
  return formatDateInput(next);
}
