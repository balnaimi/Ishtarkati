import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatUiError } from "../lib/uiErrors";
import {
  confirmSubscriptionPaid,
  getSetting,
  loadHomePaymentMethodsStats,
  loadSubscriptions,
  loadSubscriptionsDueSoon,
  loadSubscriptionsNeedingAttention,
  MONTHLY_BUDGET_LIMIT_KEY,
  statsSummary,
  type HomeCardStat,
  type SubscriptionListRow,
} from "../db/repo";
import { StatsGridSkeleton } from "../components/LoadingSkeleton";
import { BudgetBanner } from "../components/BudgetBanner";
import { HomeAttentionPanel } from "../components/HomeAttentionPanel";
import { HomeCashflowCompact } from "../components/HomeCashflowCompact";
import { HomePaymentsSnapshot } from "../components/HomePaymentsSnapshot";
import { computeBudgetStatus } from "../lib/budget";
import {
  cardExpiryProgress,
  computeDueProgress,
  dueProgressTone,
  type DueProgressInput,
} from "../lib/dueProgress";
import { IconPlus } from "../components/NavIcons";

function progressInput(s: SubscriptionListRow): DueProgressInput {
  return {
    next_due_date: s.next_due_date,
    start_date: s.start_date,
    billing_model: s.billing_model,
    interval_unit: s.interval_unit,
    interval_months: s.interval_months,
    interval_count: Math.max(1, s.interval_count ?? 1),
  };
}

function isDueSoonSub(s: SubscriptionListRow, excludeIds: Set<number>): boolean {
  if (excludeIds.has(s.id) || !s.next_due_date) return false;
  const prog = computeDueProgress(progressInput(s));
  if (!prog || prog.isOverdue || prog.daysUntilDue <= 0) return false;
  const tone = dueProgressTone(prog);
  return prog.daysUntilDue <= 14 && tone !== "safe";
}

function pickExpiringCards(cards: HomeCardStat[]): HomeCardStat[] {
  return cards.filter((c) => {
    const xp = cardExpiryProgress(c.exp_month, c.exp_year);
    return xp.monthsLeft >= 0 && xp.monthsLeft <= 3;
  });
}

export function HomePage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const [paymentStats, setPaymentStats] = useState<Awaited<
    ReturnType<typeof loadHomePaymentMethodsStats>
  > | null>(null);
  const [dueToday, setDueToday] = useState<SubscriptionListRow[]>([]);
  const [dueSoonPool, setDueSoonPool] = useState<SubscriptionListRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [budgetLimitRaw, setBudgetLimitRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, pay, today, soon, budgetRaw, active] = await Promise.all([
        statsSummary(),
        loadHomePaymentMethodsStats(),
        loadSubscriptionsNeedingAttention(),
        loadSubscriptionsDueSoon(24),
        getSetting(MONTHLY_BUDGET_LIMIT_KEY),
        loadSubscriptions({}),
      ]);
      setSummary(sum);
      setPaymentStats(pay);
      setDueToday(today);
      setDueSoonPool(soon);
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

  const dueTodayIds = useMemo(() => new Set(dueToday.map((s) => s.id)), [dueToday]);
  const dueSoon = useMemo(
    () => dueSoonPool.filter((s) => isDueSoonSub(s, dueTodayIds)).slice(0, 8),
    [dueSoonPool, dueTodayIds],
  );
  const expiringCards = useMemo(
    () => (paymentStats ? pickExpiringCards(paymentStats.cards) : []),
    [paymentStats],
  );

  return (
    <div className="dash-home space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="dash-page-title">{t("home.title")}</h1>
          <p className="dash-page-sub">{t("home.welcomeHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/new" className="dash-btn-primary no-underline">
            <IconPlus className="size-4" />
            {t("home.addAccount")}
          </Link>
          <Link to="/accounts" className="dash-btn-ghost no-underline">
            {t("home.viewAccounts")}
          </Link>
        </div>
      </header>

      {loading || !summary ? (
        <StatsGridSkeleton />
      ) : (
        <div className="dash-home-stat-row">
          <article className="dash-home-stat">
            <p className="dash-stat-label">{t("home.statActive")}</p>
            <p className="dash-stat-value">{activeCount}</p>
          </article>
          <article className="dash-home-stat">
            <p className="dash-stat-label">{t("home.statDueMonth")}</p>
            <p className="dash-stat-value">{summary.currentMonth.dueCount}</p>
            <p className="mt-0.5 text-[11px] sk-text-hint">
              {summary.currentMonth.totalPrimary.toFixed(0)} {primary}
            </p>
          </article>
          <article className="dash-home-stat">
            <p className="dash-stat-label">{t("home.statDue30")}</p>
            <p className="dash-stat-value">{summary.due30Projected.dueCount}</p>
            <p className="mt-0.5 text-[11px] sk-text-hint">
              {summary.due30Projected.totalPrimary.toFixed(0)} {primary}
            </p>
          </article>
          <article className="dash-home-stat">
            <p className="dash-stat-label">{t("home.statRecurring")}</p>
            <p className="dash-stat-value">{summary.recurringCount}</p>
          </article>
        </div>
      )}

      <div className="dash-home-grid">
        <div className="space-y-4">
          {loading ? (
            <StatsGridSkeleton />
          ) : (
            <HomeAttentionPanel
              dueToday={dueToday}
              dueSoon={dueSoon}
              expiringCards={expiringCards}
              onMarkPaid={(e, id) => void onConfirmPaid(e, id)}
            />
          )}

          {budgetStatus?.enabled ? (
            <BudgetBanner status={budgetStatus} primaryCode={primary} compact />
          ) : null}
        </div>

        <div className="space-y-4">
          {loading || !summary ? (
            <StatsGridSkeleton />
          ) : (
            <HomeCashflowCompact summary={summary} primaryCode={primary} />
          )}

          {loading || !paymentStats ? (
            <StatsGridSkeleton />
          ) : (
            <HomePaymentsSnapshot
              primaryCode={paymentStats.primaryCode}
              wallets={paymentStats.wallets}
              cards={paymentStats.cards}
              recentPayments={paymentStats.recentPayments}
            />
          )}
        </div>
      </div>
    </div>
  );
}
