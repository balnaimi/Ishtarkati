import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmSubscriptionPaid,
  loadHomePaymentMethodsStats,
  loadSubscriptionsDueSoon,
  loadSubscriptionsRecent,
  statsSummary,
  subscriptionNeedsPaidAttention,
  type SubscriptionListRow,
} from "../db/repo";
import { CashflowSummaryGrid } from "../components/CashflowSummaryGrid";
import { HomePaymentsStats } from "../components/HomePaymentsStats";
import { CardGridSkeleton, StatsGridSkeleton } from "../components/LoadingSkeleton";
import { billingModelI18nKey, isFreeAccount } from "../lib/subscriptionKind";
import { DueProgressBar } from "../components/DueProgressBar";
import { DualCurrencyAmounts } from "../components/DualCurrencyAmounts";
import { SiteFavicon } from "../components/SiteFavicon";
import {
  computeDueProgress,
  dueListRowHighlightClass,
  dueProgressTone,
  dueToneTextClass,
  relativeDueCaption,
  type DueProgressInput,
} from "../lib/dueProgress";

const HOME_PREVIEW_LIMIT = 5;

type HomeTab = "general" | "due" | "payments";

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

export function HomePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [tab, setTab] = useState<HomeTab>("general");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const [dueSoon, setDueSoon] = useState<SubscriptionListRow[]>([]);
  const [recent, setRecent] = useState<SubscriptionListRow[]>([]);
  const [paymentStats, setPaymentStats] = useState<Awaited<
    ReturnType<typeof loadHomePaymentMethodsStats>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, d, r, pay] = await Promise.all([
        statsSummary(),
        loadSubscriptionsDueSoon(HOME_PREVIEW_LIMIT),
        loadSubscriptionsRecent(HOME_PREVIEW_LIMIT),
        loadHomePaymentMethodsStats(),
      ]);
      setSummary(sum);
      setDueSoon(d);
      setRecent(r);
      setPaymentStats(pay);
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
      const detail = err instanceof Error ? err.message : String(err);
      try {
        await window.ishtarkati.showNotification({
          title: t("home.markPaidErrorTitle"),
          body: `${t("home.markPaidErrorBody")} ${detail}`,
        });
      } catch {
        /* ignore notification failures */
      }
    }
  }

  function billingLabel(model: string) {
    return t(billingModelI18nKey(model));
  }

  const primary = summary?.primaryCode ?? paymentStats?.primaryCode ?? "QAR";

  const tabs: { id: HomeTab; label: string }[] = [
    { id: "general", label: t("home.tabGeneral") },
    { id: "due", label: t("home.tabDue") },
    { id: "payments", label: t("home.tabPayments") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-cream-900">{t("home.title")}</h2>
        <p className="sk-text-hint mt-1 text-sm">{t("home.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-cream-400/70 pb-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === id
                ? "bg-cream-800 text-cream-50"
                : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        loading || !summary ? (
          <StatsGridSkeleton />
        ) : (
          <CashflowSummaryGrid summary={summary} primaryCode={primary} compact />
        )
      ) : null}

      {tab === "due" ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <section className="space-y-2.5">
            <h3 className="text-base font-semibold tracking-tight text-cream-900">
              {t("home.nearestDue")}
            </h3>
            {loading ? (
              <CardGridSkeleton count={HOME_PREVIEW_LIMIT} />
            ) : dueSoon.length === 0 ? (
              <p className="sk-text-hint text-sm">{t("home.noDueSoon")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {dueSoon.map((s) => {
                  const prog = s.next_due_date ? computeDueProgress(progressInput(s)) : null;
                  const tone = prog ? dueProgressTone(prog) : null;
                  const needsPaid = subscriptionNeedsPaidAttention(s);
                  const cardTone = tone ? dueListRowHighlightClass(tone) : "";
                  return (
                    <article
                      key={s.id}
                      className={`flex flex-col rounded-xl border border-cream-400/90 bg-cream-50/95 p-2.5 shadow-sm transition hover:border-sage-500/40 hover:shadow ${
                        needsPaid ? "sk-ring-needs-pay" : ""
                      } ${cardTone}`.trim()}
                    >
                      <div
                        role="link"
                        tabIndex={0}
                        className="min-h-0 flex-1 cursor-pointer rounded-md outline-none hover:bg-cream-100/50 focus-visible:ring-2 focus-visible:ring-sage-500/50"
                        onClick={() => nav(`/sub/${s.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            nav(`/sub/${s.id}`);
                          }
                        }}
                      >
                        <div className="flex gap-2">
                          {s.website_url?.trim() ? (
                            <SiteFavicon
                              websiteUrl={s.website_url}
                              size="xs"
                              className="mt-0.5 shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-cream-950">
                              {s.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-tight text-cream-600">
                              {s.next_due_date ?? "—"} · {billingLabel(s.billing_model)}
                            </p>
                            <div className="mt-1">
                              <DualCurrencyAmounts
                                size="xs"
                                originalAmount={s.amount_original}
                                originalCode={s.currency_code}
                                approxAmount={s.amount_qar_snapshot}
                                approxCode={primary}
                              />
                            </div>
                            {prog && tone ? (
                              <span
                                className={`mt-1 line-clamp-1 block text-[10px] font-medium leading-tight ${dueToneTextClass(tone)}`}
                              >
                                {relativeDueCaption(t, prog)}
                              </span>
                            ) : null}
                            {s.next_due_date ? (
                              <div className="mt-1.5 min-w-0">
                                <DueProgressBar
                                  sub={progressInput(s)}
                                  size="sm"
                                  showCaption={false}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-cream-300/70 pt-2">
                        {needsPaid ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md bg-sage-600 px-2 py-1 text-[11px] font-medium text-cream-50 transition-colors hover:bg-sage-700"
                            onClick={(e) => void onConfirmPaid(e, s.id)}
                          >
                            {t("home.markPaid")}
                          </button>
                        ) : null}
                        <Link
                          to={`/sub/${s.id}/edit`}
                          className="inline-flex items-center justify-center rounded-md border border-cream-500 bg-cream-100 px-2 py-1 text-[11px] font-medium text-cream-900 no-underline transition-colors hover:bg-cream-200"
                        >
                          {t("common.edit")}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <h3 className="text-base font-semibold tracking-tight text-cream-900">
              {t("home.recentAdded")}
            </h3>
            {loading ? (
              <CardGridSkeleton count={HOME_PREVIEW_LIMIT} />
            ) : recent.length === 0 ? (
              <p className="sk-text-hint text-sm">{t("common.none")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {recent.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex flex-col rounded-xl border border-cream-400/90 bg-cream-50/95 p-2.5 text-start shadow-sm transition hover:border-sage-500/40 hover:bg-cream-100/40 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/50"
                    onClick={() => nav(`/sub/${s.id}`)}
                  >
                    <div className="flex gap-2">
                      {s.website_url?.trim() ? (
                        <SiteFavicon
                          websiteUrl={s.website_url}
                          size="xs"
                          className="mt-0.5 shrink-0"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-cream-950">
                          {s.title}
                        </p>
                        <p className="mt-1 text-[11px] text-cream-600">
                          {s.created_at.slice(0, 10)} · {billingLabel(s.billing_model)}
                        </p>
                        {isFreeAccount(s) ? (
                          s.account_label?.trim() ? (
                            <p dir="ltr" className="mt-1 truncate text-[11px] text-sage-800">
                              {s.account_label.trim()}
                            </p>
                          ) : null
                        ) : (
                          <div className="mt-1">
                            <DualCurrencyAmounts
                              size="xs"
                              originalAmount={s.amount_original}
                              originalCode={s.currency_code}
                              approxAmount={s.amount_qar_snapshot}
                              approxCode={primary}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "payments" ? (
        loading || !paymentStats ? (
          <StatsGridSkeleton />
        ) : (
          <HomePaymentsStats
            primaryCode={paymentStats.primaryCode}
            wallets={paymentStats.wallets}
            cards={paymentStats.cards}
            recentPayments={paymentStats.recentPayments}
          />
        )
      ) : null}
    </div>
  );
}
