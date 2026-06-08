import type { IntervalUnit, Subscription } from "../types";
import {
  addBillingSteps,
  formatDateInput,
  parseDateInput,
  subtractBillingSteps,
} from "./schedule";

const MAX_STEPS = 200_000;

export function isoCalendarMonthBounds(year: number, monthIndex0: number): { start: string; end: string } {
  const last = new Date(year, monthIndex0 + 1, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${p(monthIndex0 + 1)}-01`,
    end: `${year}-${p(monthIndex0 + 1)}-${p(last)}`,
  };
}

/** Full subscription shape used for due-date projection. */
export type CashflowSub = Pick<
  Subscription,
  | "billing_model"
  | "next_due_date"
  | "interval_unit"
  | "interval_count"
  | "start_date"
  | "end_date"
  | "cancelled_at"
  | "amount_qar_snapshot"
> & { id?: number };

function isActive(s: CashflowSub): boolean {
  return !s.cancelled_at?.trim();
}

/**
 * All billing due dates (YYYY-MM-DD) for the subscription that fall in [rangeStartDay, rangeEndDay] inclusive.
 * Each date is one full payment of `amount_qar_snapshot` — no spreading across months.
 */
export function listDueDatesInInclusiveRange(
  s: CashflowSub,
  rangeStartDay: string,
  rangeEndDay: string,
): string[] {
  if (!isActive(s)) return [];
  if (s.billing_model === "free_account") return [];
  const rs = parseDateInput(rangeStartDay);
  const re = parseDateInput(rangeEndDay);
  if (!rs || !re || rs > re) return [];

  if (s.billing_model === "one_time") {
    const nd = s.next_due_date;
    if (!nd || nd < rangeStartDay || nd > rangeEndDay) return [];
    if (s.start_date && nd < s.start_date) return [];
    if (s.end_date && nd > s.end_date) return [];
    return [nd];
  }

  if (!s.next_due_date || !s.interval_unit) return [];

  let d = parseDateInput(s.next_due_date);
  if (!d) return [];

  const unit = s.interval_unit as IntervalUnit;
  const count = Math.max(1, s.interval_count ?? 1);

  let steps = 0;
  while (d > re && steps < MAX_STEPS) {
    d = subtractBillingSteps(d, unit, count);
    steps++;
  }
  if (d > re) return [];

  steps = 0;
  while (d >= rs && steps < MAX_STEPS) {
    const prev = subtractBillingSteps(d, unit, count);
    if (prev.getTime() >= d.getTime()) break;
    d = prev;
    steps++;
  }

  steps = 0;
  while (d < rs && steps < MAX_STEPS) {
    d = addBillingSteps(d, unit, count);
    steps++;
  }

  const out: string[] = [];
  steps = 0;
  while (d <= re && steps < MAX_STEPS) {
    const iso = formatDateInput(d);
    if (s.start_date && iso < s.start_date) {
      d = addBillingSteps(d, unit, count);
      steps++;
      continue;
    }
    if (s.end_date && iso > s.end_date) break;
    if (iso >= rangeStartDay && iso <= rangeEndDay) out.push(iso);
    d = addBillingSteps(d, unit, count);
    steps++;
  }
  return out;
}

export function countAndSumCashflowInRange(
  subs: CashflowSub[],
  rangeStartDay: string,
  rangeEndDay: string,
): { totalPrimary: number; dueCount: number } {
  let totalPrimary = 0;
  let dueCount = 0;
  for (const s of subs) {
    const amt = s.amount_qar_snapshot;
    if (amt == null) continue;
    const dates = listDueDatesInInclusiveRange(s, rangeStartDay, rangeEndDay);
    if (dates.length === 0) continue;
    dueCount += dates.length;
    totalPrimary += dates.length * amt;
  }
  return { totalPrimary, dueCount };
}

export function cashflowByCategoryInRange(
  subs: Array<CashflowSub & { category_name?: string | null }>,
  rangeStartDay: string,
  rangeEndDay: string,
): { name: string; amountPrimary: number }[] {
  const catMap = new Map<string, number>();
  for (const s of subs) {
    const amt = s.amount_qar_snapshot;
    if (amt == null) continue;
    const n = listDueDatesInInclusiveRange(s, rangeStartDay, rangeEndDay).length;
    if (n === 0) continue;
    const cname = s.category_name ?? "—";
    catMap.set(cname, (catMap.get(cname) ?? 0) + n * amt);
  }
  return [...catMap.entries()]
    .map(([name, amountPrimary]) => ({ name, amountPrimary }))
    .sort((a, b) => b.amountPrimary - a.amountPrimary);
}

/** For a calendar year, total projected primary per month (1–12). */
export function projectedTotalsByMonthIndex(
  subs: CashflowSub[],
  year: number,
): number[] {
  const totals = new Array(12).fill(0);
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  for (const s of subs) {
    const amt = s.amount_qar_snapshot;
    if (amt == null) continue;
    for (const iso of listDueDatesInInclusiveRange(s, yStart, yEnd)) {
      const m = Number(iso.slice(5, 7));
      if (m >= 1 && m <= 12) totals[m - 1] += amt;
    }
  }
  return totals;
}

/** Map YYYY-MM-DD → subscriptions due that day (with amounts). */
export function mapSubsDueByDayInMonth(
  subs: Array<CashflowSub & { id: number; title: string }>,
  year: number,
  monthIndex0: number,
): Map<string, { subId: number; title: string; amountPrimary: number }[]> {
  const start = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-01`;
  const last = new Date(year, monthIndex0 + 1, 0).getDate();
  const end = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const map = new Map<string, { subId: number; title: string; amountPrimary: number }[]>();

  for (const s of subs) {
    const amt = s.amount_qar_snapshot;
    if (amt == null) continue;
    for (const day of listDueDatesInInclusiveRange(s, start, end)) {
      const list = map.get(day) ?? [];
      list.push({ subId: s.id, title: s.title, amountPrimary: amt });
      map.set(day, list);
    }
  }
  return map;
}
