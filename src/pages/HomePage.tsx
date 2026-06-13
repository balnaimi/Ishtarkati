import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatUiError } from "../lib/uiErrors";
import {
  confirmSubscriptionPaid,
  getSetting,
  loadHomePaymentMethodsStats,
  loadSubscriptions,
  loadSubscriptionsNeedingAttention,
  MONTHLY_BUDGET_LIMIT_KEY,
  statsSummary,
  subscriptionNeedsPaidAttention,
  type SubscriptionListRow,
} from "../db/repo";
import { HomePaymentsStats } from "../components/HomePaymentsStats";
import { StatsGridSkeleton } from "../components/LoadingSkeleton";
import { BudgetBanner } from "../components/BudgetBanner";
import { DashboardCashflowCard } from "../components/DashboardCashflowCard";
import { SiteFavicon } from "../components/SiteFavicon";
import { computeBudgetStatus } from "../lib/budget";

export function HomePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const [paymentStats, setPaymentStats] = useState<Awaited<
    ReturnType<typeof loadHomePaymentMethodsStats>
  > | null>(null);
  const [dueToday, setDueToday] = useState<SubscriptionListRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [budgetLimitRaw, setBudgetLimitRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, pay, today, budgetRaw, active] = await Promise.all([
        statsSummary(),
        loadHomePaymentMethodsStats(),
        loadSubscriptionsNeedingAttention(),
        getSetting(MONTHLY_BUDGET_LIMIT_KEY),
        loadSubscriptions({}),
      ]);
      setSummary(sum);
      setPaymentStats(pay);
      setDueToday(today);
      setBudgetLimitRaw(budgetRaw);
      setActiveCount(active.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onConfirmPaid(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    try {
      await confirmSubscriptionPaid(id);
      void reload();
    } catch (err) {
      const detail = formatUiError(t, err);
      try {
        await window.ishtarkati.showNotification({
          title: t("home.markPaidErrorTitle"),
          body: `${t("home.markPaidErrorBody")} ${detail}`,
        });
      } catch {
        /* ignore */
      }
    }
  }

  const primary = summary?.primaryCode ?? paymentStats?.primaryCode ?? "QAR";
  const budgetStatus = summary
    ? computeBudgetStatus(summary.currentMonth.totalPrimary, budgetLimitRaw)
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="dash-page-title">{t("home.title")}</h1>
        <p className="dash-page-sub">{t("home.welcomeHint")}</p>
      </header>

      {loading || !summary ? (
        <StatsGridSkeleton />
      ) : (
        <div className="dash-stat-grid">
          <article className="dash-stat-card">
            <p className="dash-stat-label">{t("home.statActive")}</p>
            <p className="dash-stat-value">{activeCount}</p>
          </article>
          <article className="dash-stat-card">
            <p className="dash-stat-label">{t("home.statDueMonth")}</p>
            <p className="dash-stat-value">{summary.currentMonth.dueCount}</p>
          </article>
        </div>
      )}

      {!loading && dueToday.length > 0 ? (
        <section className="dash-card-alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="dash-card-title text-brand-danger">{t("home.dueTodayTitle")}</h2>
              <p className="mt-1 text-sm text-cream-800">
                {t("home.dueTodayCount", { count: dueToday.length })}
              </p>
            </div>
            <Link to="/accounts" className="dash-btn-primary text-sm no-underline">
              {t("home.dueTodayView")}
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {dueToday.slice(0, 5).map((s) => {
              const needsPaid = subscriptionNeedsPaidAttention(s);
              return (
                <li key={s.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream-100/40 px-3 py-2.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-start"
                      onClick={() => nav(`/sub/${s.id}`)}
                    >
                      <SiteFavicon websiteUrl={s.website_url} size="sm" />
                      <span className="font-medium text-cream-950">{s.title}</span>
                      <span className="text-sm sk-text-hint">
                        {s.amount_original} {s.currency_code}
                      </span>
                    </button>
                    {needsPaid ? (
                      <button
                        type="button"
                        className="dash-btn-primary !min-h-8 px-3 py-1 text-xs"
                        onClick={(e) => void onConfirmPaid(e, s.id)}
                      >
                        {t("home.markPaid")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {budgetStatus?.enabled ? <BudgetBanner status={budgetStatus} primaryCode={primary} /> : null}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          {loading || !summary ? (
            <StatsGridSkeleton />
          ) : (
            <DashboardCashflowCard summary={summary} primaryCode={primary} />
          )}
        </div>
        <div className="xl:col-span-2">
          {loading || !paymentStats ? (
            <StatsGridSkeleton />
          ) : (
            <div className="dash-card">
              <HomePaymentsStats
                primaryCode={paymentStats.primaryCode}
                wallets={paymentStats.wallets}
                cards={paymentStats.cards}
                recentPayments={paymentStats.recentPayments}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
