import { useTranslation } from "react-i18next";
import { statsSummary } from "../db/repo";

type Summary = Awaited<ReturnType<typeof statsSummary>>;

type Props = {
  summary: Summary;
  primaryCode: string;
  /** Hide recurring count and category breakdown (home general tab). */
  compact?: boolean;
};

export function CashflowSummaryGrid({ summary, primaryCode, compact = false }: Props) {
  const { t } = useTranslation();
  const primary = primaryCode;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("insights.dueThisMonth")}</p>
        <p className="mt-1 text-xs text-cream-600">
          {t("insights.monthNumbered", {
            month: summary.currentMonth.month,
            year: summary.currentMonth.year,
          })}
        </p>
        <p className="mt-2 text-2xl font-semibold text-sage-800">
          {summary.currentMonth.totalPrimary.toFixed(2)} {primary}
        </p>
        <p className="sk-text-hint mt-2 text-xs">
          {t("insights.dueEvents", { count: summary.currentMonth.dueCount })}
        </p>
      </div>
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("insights.dueNextMonth")}</p>
        <p className="mt-1 text-xs text-cream-600">
          {t("insights.monthNumbered", {
            month: summary.nextMonth.month,
            year: summary.nextMonth.year,
          })}
        </p>
        <p className="mt-2 text-2xl font-semibold text-sage-800">
          {summary.nextMonth.totalPrimary.toFixed(2)} {primary}
        </p>
        <p className="sk-text-hint mt-2 text-xs">
          {t("insights.dueEvents", { count: summary.nextMonth.dueCount })}
        </p>
      </div>
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("insights.projectedYear")}</p>
        <p className="mt-1 text-xs text-cream-600">
          {t("insights.yearLabel", { year: summary.currentYearProjected.year })}
        </p>
        <p className="mt-2 text-2xl font-semibold text-sage-800">
          {summary.currentYearProjected.totalPrimary.toFixed(2)} {primary}
        </p>
        <p className="sk-text-hint mt-2 text-xs">
          {t("insights.dueEvents", { count: summary.currentYearProjected.dueCount })}
        </p>
      </div>
      <div className="sk-card">
        <p className="sk-text-hint text-sm font-medium">{t("insights.due30")}</p>
        <p className="mt-2 text-2xl font-semibold text-walnut-600">
          {summary.due30Projected.totalPrimary.toFixed(2)} {primary}
        </p>
        <p className="sk-text-hint mt-2 text-xs">
          {t("insights.dueEvents", { count: summary.due30Projected.dueCount })}
        </p>
      </div>
      {!compact ? (
        <>
          <div className="md:col-span-2 sk-card">
            <p className="sk-text-hint mb-1 text-sm font-medium">{t("stats.subscriptions")}</p>
            <p className="text-sm text-cream-800">{summary.recurringCount}</p>
          </div>
          <div className="md:col-span-2 sk-card">
            <p className="sk-text-hint mb-3 text-sm font-medium">{t("insights.byCategoryThisMonth")}</p>
            <ul className="space-y-2">
              {summary.byCategory.length === 0 ? (
                <li className="sk-text-hint">{t("common.none")}</li>
              ) : (
                summary.byCategory.map((row) => (
                  <li
                    key={row.name}
                    className="flex flex-wrap justify-between gap-2 text-sm text-cream-800"
                  >
                    <span>{row.name}</span>
                    <span className="font-medium text-sage-800">
                      {row.amountPrimary.toFixed(2)} {primary}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
