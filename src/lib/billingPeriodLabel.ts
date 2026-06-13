import type { TFunction } from "i18next";
import type { Subscription } from "../types";

type BillingPick = Pick<Subscription, "billing_model" | "interval_unit" | "interval_count">;

/**
 * Second line for list UIs: daily / monthly / yearly period label with interval count when > 1.
 */
export function subscriptionBillingPeriodLine(sub: BillingPick, t: TFunction): string | null {
  if (sub.billing_model !== "recurring") return null;
  const unit = sub.interval_unit;
  const c = Math.max(1, sub.interval_count ?? 1);
  if (!unit) return null;
  switch (unit) {
    case "day":
      return c === 1 ? t("list.period.day") : t("list.period.everyDays", { count: c });
    case "week":
      return c === 1 ? t("interval.week") : t("list.period.everyWeeks", { count: c });
    case "month":
      return c === 1 ? t("interval.month") : t("list.period.everyMonths", { count: c });
    case "year":
      return c === 1 ? t("interval.year") : t("list.period.everyYears", { count: c });
    default:
      return null;
  }
}
