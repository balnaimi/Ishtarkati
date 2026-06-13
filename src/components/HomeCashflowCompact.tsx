import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { statsSummary } from "../db/repo";

type Summary = Awaited<ReturnType<typeof statsSummary>>;

type Props = {
  summary: Summary;
  primaryCode: string;
};

export function HomeCashflowCompact({ summary, primaryCode }: Props) {
  const { t } = useTranslation();
  const items = [
    {
      label: t("home.cashflowPaid"),
      value: summary.currentMonth.totalPrimary,
      count: summary.currentMonth.dueCount,
      tone: "bg-sage-500",
    },
    {
      label: t("home.cashflowRemaining"),
      value: summary.nextMonth.totalPrimary,
      count: summary.nextMonth.dueCount,
      tone: "bg-violet-500",
    },
    {
      label: t("home.cashflowSpent"),
      value: summary.due30Projected.totalPrimary,
      count: summary.due30Projected.dueCount,
      tone: "bg-sky-500",
    },
    {
      label: t("insights.projectedYear"),
      value: summary.currentYearProjected.totalPrimary,
      count: summary.currentYearProjected.dueCount,
      tone: "bg-violet-400",
    },
  ];
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <section className="dash-home-panel">
      <div className="dash-home-panel-head">
        <div>
          <h2 className="dash-card-title">{t("home.cashflowTitle")}</h2>
          <p className="mt-0.5 text-xs sk-text-hint">{t("home.cashflowHint")}</p>
        </div>
        <Link to="/insights" className="dash-btn-ghost !min-h-8 text-xs no-underline">
          {t("home.viewInsights")}
        </Link>
      </div>
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-cream-400/50 bg-cream-200/25 px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] sk-text-hint">{item.label}</span>
              <span className="text-[10px] sk-text-hint">{item.count}</span>
            </div>
            <p className="mt-0.5 text-sm font-bold text-cream-950">
              {item.value.toFixed(0)} {primaryCode}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-300/70">
              <div
                className={`h-full rounded-full ${item.tone}`}
                style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {summary.byCategory.length > 0 ? (
        <div className="border-t border-cream-400/40 px-3 py-2.5">
          <p className="text-[11px] font-semibold sk-text-hint">{t("home.topCategories")}</p>
          <ul className="mt-1.5 space-y-1">
            {summary.byCategory.slice(0, 3).map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-cream-800">{c.name}</span>
                <span className="shrink-0 font-medium text-cream-950">
                  {c.amountPrimary.toFixed(0)} {primaryCode}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
