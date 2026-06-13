import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { BudgetStatus } from "../lib/budget";

interface BudgetBannerProps {
  status: BudgetStatus;
  primaryCode: string;
  compact?: boolean;
}

export function BudgetBanner({ status, primaryCode, compact = false }: BudgetBannerProps) {
  const { t } = useTranslation();
  if (!status.enabled) return null;

  const tone = status.over
    ? "border-brand-danger/45 bg-brand-danger/10"
    : status.pct >= 85
      ? "border-brand-warn/45 bg-brand-warn/12"
      : "border-sage-500/35 bg-sage-500/10";

  return (
    <section className={`dash-home-panel ${tone}`}>
      <div className="dash-home-panel-head">
        <div>
          <h2 className="dash-card-title">{t("budget.title")}</h2>
          <p className="mt-0.5 text-xs sk-text-hint">
            {status.spent.toFixed(2)} / {status.limit.toFixed(2)} {primaryCode}
          </p>
        </div>
        <Link to="/settings" className="dash-btn-ghost !min-h-8 text-xs no-underline">
          {t("home.budgetAdjust")}
        </Link>
      </div>
      <div className={compact ? "px-3 pb-3" : "px-4 pb-4"}>
        <div className="h-2 overflow-hidden rounded-full bg-cream-300/70">
          <div
            className={`h-full rounded-full transition-all ${
              status.over ? "bg-brand-danger" : status.pct >= 85 ? "bg-brand-warn" : "bg-sage-500"
            }`}
            style={{ width: `${Math.min(100, status.pct)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-cream-800">
          {status.over
            ? t("budget.over", {
                amount: (status.spent - status.limit).toFixed(2),
                code: primaryCode,
              })
            : t("budget.remaining", { amount: status.remaining.toFixed(2), code: primaryCode })}
        </p>
      </div>
    </section>
  );
}
