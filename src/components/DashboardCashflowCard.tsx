import { useTranslation } from "react-i18next";
import { statsSummary } from "../db/repo";

type Summary = Awaited<ReturnType<typeof statsSummary>>;

type Props = {
  summary: Summary;
  primaryCode: string;
};

/** Compact cashflow overview with simple bar visualization. */
export function DashboardCashflowCard({ summary, primaryCode }: Props) {
  const { t } = useTranslation();
  const bars = [
    {
      label: t("insights.dueThisMonth"),
      paid: summary.currentMonth.totalPrimary,
      tone: "bg-sage-400",
    },
    {
      label: t("insights.dueNextMonth"),
      paid: summary.nextMonth.totalPrimary,
      tone: "bg-violet-500",
    },
    {
      label: t("insights.due30"),
      paid: summary.due30Projected.totalPrimary,
      tone: "bg-sky-400",
    },
    {
      label: t("insights.projectedYear"),
      paid: summary.currentYearProjected.totalPrimary,
      tone: "bg-violet-400",
    },
  ];
  const max = Math.max(...bars.map((b) => b.paid), 1);

  return (
    <section className="dash-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="dash-card-title">{t("home.cashflowTitle")}</h3>
          <p className="mt-1 text-xs text-cream-600">{t("home.cashflowHint")}</p>
        </div>
        <span className="dash-chip dash-chip-idle">{t("home.cashflowPeriod")}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-3">
        <div>
          <p className="text-xs text-cream-600">{t("home.cashflowPaid")}</p>
          <p className="mt-1 text-lg font-bold text-sage-400">
            {summary.currentMonth.totalPrimary.toFixed(0)} {primaryCode}
          </p>
        </div>
        <div>
          <p className="text-xs text-cream-600">{t("home.cashflowRemaining")}</p>
          <p className="mt-1 text-lg font-bold text-cream-950">
            {summary.nextMonth.totalPrimary.toFixed(0)} {primaryCode}
          </p>
        </div>
        <div>
          <p className="text-xs text-cream-600">{t("home.cashflowSpent")}</p>
          <p className="mt-1 text-lg font-bold text-brand-danger">
            {summary.due30Projected.totalPrimary.toFixed(0)} {primaryCode}
          </p>
        </div>
      </div>

      <div className="mt-6 flex h-36 items-end justify-between gap-2">
        {bars.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end justify-center gap-1">
              <div
                className={`w-3 rounded-t-md ${b.tone} opacity-90`}
                style={{ height: `${Math.max(8, (b.paid / max) * 100)}%` }}
                title={`${b.paid.toFixed(0)} ${primaryCode}`}
              />
            </div>
            <span className="line-clamp-2 text-center text-[10px] text-cream-600">{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
