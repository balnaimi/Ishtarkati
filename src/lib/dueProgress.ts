import {
  addDays,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";
import type { TFunction } from "i18next";
import type { IntervalUnit } from "../types";
import { parseDateInput, subtractBillingSteps } from "./schedule";

/** Subscription-like shape for progress (list or detail rows). */
export interface DueProgressInput {
  next_due_date: string | null;
  start_date: string | null;
  billing_model: string;
  interval_unit: IntervalUnit | null;
  interval_months: number | null;
  interval_count: number;
}

export interface DueProgressResult {
  /** 0 = start of cycle, 1 = due date (start of day), >1 if past due */
  ratio: number;
  isOverdue: boolean;
  /** Calendar days until due (negative if overdue) */
  daysUntilDue: number;
  periodStart: Date;
  periodEnd: Date;
}

/** Start of billing window leading up to next_due_date. */
export function estimatePeriodStart(input: DueProgressInput): Date | null {
  const next = parseDateInput(input.next_due_date);
  if (!next) return null;
  const end = startOfDay(next);

  if (input.billing_model === "recurring" && input.interval_unit) {
    const cnt = Math.max(1, input.interval_count || 1);
    const start = subtractBillingSteps(end, input.interval_unit, cnt);
    if (differenceInCalendarDays(end, start) < 1) {
      return addDays(end, -1);
    }
    return startOfDay(start);
  }

  const userStart = parseDateInput(input.start_date);
  if (userStart) {
    const s = startOfDay(userStart);
    if (differenceInCalendarDays(end, s) < 1) {
      return addDays(end, -30);
    }
    return s;
  }

  return startOfDay(addDays(end, -45));
}

export function computeDueProgress(
  input: DueProgressInput,
  now: Date = new Date(),
): DueProgressResult | null {
  const next = parseDateInput(input.next_due_date);
  if (!next) return null;
  const periodEnd = startOfDay(next);
  const periodStartRaw = estimatePeriodStart(input);
  if (!periodStartRaw) return null;
  let periodStart = startOfDay(periodStartRaw);
  if (differenceInCalendarDays(periodEnd, periodStart) < 1) {
    periodStart = startOfDay(addDays(periodEnd, -7));
  }

  const today = startOfDay(now);
  const totalDays = Math.max(1, differenceInCalendarDays(periodEnd, periodStart));
  const elapsed = differenceInCalendarDays(today, periodStart);
  const ratio = elapsed / totalDays;
  const isOverdue = today > periodEnd;
  const daysUntilDue = differenceInCalendarDays(periodEnd, today);

  return {
    ratio,
    isOverdue,
    daysUntilDue,
    periodStart,
    periodEnd,
  };
}

/** Tailwind classes for fill (cream theme friendly). */
export function dueProgressTone(
  r: DueProgressResult,
): "safe" | "warn" | "urgent" | "due" | "overdue" {
  if (r.isOverdue) return "overdue";
  if (r.daysUntilDue <= 0) return "due";
  if (r.daysUntilDue <= 3 || r.ratio >= 0.92) return "urgent";
  if (r.daysUntilDue <= 10 || r.ratio >= 0.75) return "warn";
  return "safe";
}

export const DUE_TONE_BAR: Record<
  ReturnType<typeof dueProgressTone>,
  string
> = {
  safe: "sk-due-bar-fill-safe",
  warn: "sk-due-bar-fill-warn",
  urgent: "sk-due-bar-fill-urgent",
  due: "sk-due-bar-fill-due",
  overdue: "sk-due-bar-fill-overdue",
};

export const DUE_TONE_TRACK: Record<
  ReturnType<typeof dueProgressTone>,
  string
> = {
  safe: "sk-due-bar-track-safe",
  warn: "sk-due-bar-track-warn",
  urgent: "sk-due-bar-track-urgent",
  due: "sk-due-bar-track-due",
  overdue: "sk-due-bar-track-overdue",
};

/** Bar width 0–100; overdue stays full. */
export function dueProgressWidthPercent(r: DueProgressResult): number {
  if (r.isOverdue) return 100;
  return Math.min(100, Math.max(0, r.ratio * 100));
}

/** Short Arabic line for list cells / tooltips (same keys as DueProgressBar). */
export function relativeDueCaption(
  t: TFunction<"translation">,
  p: DueProgressResult,
): string {
  if (p.isOverdue) {
    return t("due.captionOverdue", { count: Math.abs(p.daysUntilDue) });
  }
  if (p.daysUntilDue <= 0) return t("due.captionToday");
  if (p.daysUntilDue === 1) return t("due.captionTomorrow");
  return t("due.captionDays", { count: p.daysUntilDue });
}

export type DueTone = ReturnType<typeof dueProgressTone>;

/** Subtle table row background by urgency (empty if safe or unknown). */
export function dueListRowHighlightClass(tone: DueTone): string {
  if (tone === "safe") return "";
  if (tone === "warn") return "sk-due-row-warn";
  if (tone === "urgent") return "sk-due-row-urgent";
  if (tone === "due") return "sk-due-row-due";
  return "sk-due-row-overdue";
}

/** Card expiry: months remaining until end of exp year/month (rough bar). */
export function cardExpiryProgress(
  expMonth: number,
  expYear: number,
  now: Date = new Date(),
): { ratio: number; monthsLeft: number; urgent: boolean } {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const totalMonthsLeft = (expYear - y) * 12 + (expMonth - m);
  const maxSpan = 36;
  const ratio = Math.min(1, Math.max(0, 1 - totalMonthsLeft / maxSpan));
  return {
    ratio,
    monthsLeft: totalMonthsLeft,
    urgent: totalMonthsLeft <= 3,
  };
}
