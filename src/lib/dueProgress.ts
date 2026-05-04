import {
  addDays,
  differenceInCalendarDays,
  startOfDay,
  subMonths,
} from "date-fns";
import type { TFunction } from "i18next";
import type { IntervalUnit } from "../types";
import { intervalToMonths, parseDateInput } from "./schedule";

/** Subscription-like shape for progress (list or detail rows). */
export interface DueProgressInput {
  next_due_date: string | null;
  start_date: string | null;
  billing_model: string;
  interval_unit: IntervalUnit | null;
  interval_months: number | null;
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
    const months = intervalToMonths(input.interval_unit, input.interval_months);
    if (months > 0) {
      const start = subMonths(end, months);
      if (differenceInCalendarDays(end, start) < 1) {
        return addDays(end, -1);
      }
      return startOfDay(start);
    }
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
  safe: "bg-sage-500",
  warn: "bg-amber-500",
  urgent: "bg-orange-600",
  due: "bg-red-600",
  overdue: "bg-red-800",
};

export const DUE_TONE_TRACK: Record<
  ReturnType<typeof dueProgressTone>,
  string
> = {
  safe: "bg-cream-300/90",
  warn: "bg-amber-200/80",
  urgent: "bg-orange-200/70",
  due: "bg-red-200/70",
  overdue: "bg-red-300/80",
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
  if (tone === "warn") return "bg-amber-50/50";
  if (tone === "urgent") return "bg-orange-50/45";
  if (tone === "due") return "bg-red-50/55";
  return "bg-red-100/50";
}
