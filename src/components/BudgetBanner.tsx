import { useTranslation } from "react-i18next";
import type { BudgetStatus } from "../lib/budget";

interface BudgetBannerProps {
  status: BudgetStatus;
  primaryCode: string;
}

export function BudgetBanner({ status, primaryCode }: BudgetBannerProps) {
  const { t } = useTranslation();
  if (!status.enabled) return null;

  const tone = status.over
    ? "border-terracotta-500/50 bg-terracotta-50/80 dark:bg-terracotta-950/30"
    : status.pct >= 85
      ? "border-honey-500/50 bg-honey-50/80 dark:bg-honey-950/20"
      : "border-sage-500/40 bg-sage-50/60 dark:bg-sage-950/20";

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-cream-900">{t("budget.title")}</h3>
        <p className="text-sm text-cream-700">
          {status.spent.toFixed(2)} / {status.limit.toFixed(2)} {primaryCode}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-300/80">
        <div
          className={`h-full rounded-full transition-all ${
            status.over ? "bg-terracotta-500" : status.pct >= 85 ? "bg-honey-500" : "bg-sage-600"
          }`}
          style={{ width: `${Math.min(100, status.pct)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-cream-800">
        {status.over
          ? t("budget.over", { amount: (status.spent - status.limit).toFixed(2), code: primaryCode })
          : t("budget.remaining", { amount: status.remaining.toFixed(2), code: primaryCode })}
      </p>
    </section>
  );
}
