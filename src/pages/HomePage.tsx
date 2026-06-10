import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmSubscriptionPaid,
  loadCreditCards,
  loadOnlineAccountsRecent,
  loadSubscriptionsDueSoon,
  loadSubscriptionsNeedingAttention,
  loadSubscriptionsRecent,
  statsSummary,
  subscriptionNeedsPaidAttention,
  type SubscriptionListRow,
} from "../db/repo";
import { CashflowSummaryGrid } from "../components/CashflowSummaryGrid";
import { HomeCreditCardsSummary } from "../components/HomeCreditCardsSummary";
import { CardGridSkeleton, StatsGridSkeleton } from "../components/LoadingSkeleton";
import type { CreditCard } from "../types";
import {
  accountPaymentStatus,
  accountPaymentStatusI18nKey,
  billingModelI18nKey,
  isFreeAccount,
} from "../lib/subscriptionKind";
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

const HOME_PREVIEW_LIMIT = 6;
const ATTENTION_BANNER_LIMIT = 12;

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
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const [dueSoon, setDueSoon] = useState<SubscriptionListRow[]>([]);
  const [recent, setRecent] = useState<SubscriptionListRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [attentionAll, setAttentionAll] = useState<SubscriptionListRow[]>([]);
  const [freeAccounts, setFreeAccounts] = useState<SubscriptionListRow[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, d, r, attention, free, cards] = await Promise.all([
        statsSummary(),
        loadSubscriptionsDueSoon(HOME_PREVIEW_LIMIT),
        loadSubscriptionsRecent(HOME_PREVIEW_LIMIT),
        loadSubscriptionsNeedingAttention(),
        loadOnlineAccountsRecent(HOME_PREVIEW_LIMIT),
        loadCreditCards(),
      ]);
      setSummary(sum);
      setDueSoon(d);
      setRecent(r);
      setFreeAccounts(free);
      setCreditCards(cards);
      setAttentionAll(attention);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attentionList = attentionAll.slice(0, ATTENTION_BANNER_LIMIT);
  const attentionMore = Math.max(0, attentionAll.length - ATTENTION_BANNER_LIMIT);

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

  const primary = summary?.primaryCode ?? "QAR";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("home.dashboardTitle")}</h2>
          <p className="sk-text-hint text-sm">{t("home.dashboardSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/new" className="sk-btn-warm px-5 py-2.5 text-center font-semibold shadow-sm">
            {t("home.addSubscriptionCta")}
          </Link>
          <Link to="/list" className="sk-btn-secondary px-4 py-2.5 text-center">
            {t("home.allSubscriptions")}
          </Link>
          <Link to="/accounts" className="sk-btn-secondary px-4 py-2.5 text-center">
            {t("nav.accounts")}
          </Link>
          <Link to="/payments" className="sk-btn-secondary px-4 py-2.5 text-center">
            {t("nav.payments")}
          </Link>
        </div>
      </div>

      {attentionList.length > 0 ? (
        <div className="sk-callout-warning px-4 py-3 shadow-sm" role="status">
          <p className="font-semibold">{t("home.attentionBannerTitle")}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            {attentionList.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="font-semibold text-cream-950 underline-offset-4 hover:underline"
                  onClick={() => nav(`/sub/${s.id}`)}
                >
                  {s.title}
                </button>
                {" — "}
                {t("home.attentionLine", { date: s.next_due_date ?? "" })}
              </li>
            ))}
            {attentionMore > 0 ? (
              <li className="text-cream-700">
                {t("home.attentionMore", { count: attentionMore })}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {loading || !summary ? (
        <StatsGridSkeleton />
      ) : (
        <CashflowSummaryGrid
          summary={summary}
          primaryCode={primary}
          topHint={
            <>
              <p className="sk-text-hint text-sm">{t("home.statsCashflowHint")}</p>
              <Link
                to="/insights"
                className="mt-2 inline-block text-sm font-medium text-sage-800 underline"
              >
                {t("home.openInsights")}
              </Link>
            </>
          }
        />
      )}

      {!loading ? (
        <div className="grid gap-5 md:grid-cols-2">
          <HomeCreditCardsSummary cards={creditCards} />
        </div>
      ) : null}

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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
                              <DueProgressBar sub={progressInput(s)} size="sm" showCaption={false} />
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
          {recent.length === 0 ? (
            <p className="sk-text-hint text-sm">{t("common.none")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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

      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold tracking-tight text-cream-900">
            {t("home.onlineAccounts")}
          </h3>
          <Link to="/accounts" className="text-sm font-medium text-sage-800 underline-offset-2 hover:underline">
            {t("home.openAccounts")}
          </Link>
        </div>
        <p className="sk-text-hint text-sm">{t("home.onlineAccountsHint")}</p>
        {freeAccounts.length === 0 ? (
          <p className="sk-text-hint text-sm">{t("accounts.empty")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {freeAccounts.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex flex-col rounded-xl border border-cream-400/90 bg-cream-50/95 p-2.5 text-start shadow-sm transition hover:border-sage-500/40 hover:bg-cream-100/40 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500/50"
                onClick={() => nav(`/sub/${s.id}`)}
              >
                <div className="flex gap-2">
                  {s.website_url?.trim() ? (
                    <SiteFavicon websiteUrl={s.website_url} size="xs" className="mt-0.5 shrink-0" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-cream-950">
                      {s.title}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-cream-600">
                      {t(accountPaymentStatusI18nKey(accountPaymentStatus(s)))}
                    </p>
                    {s.account_label?.trim() ? (
                      <p dir="ltr" className="mt-0.5 truncate text-[11px] text-sage-800">
                        {s.account_label.trim()}
                      </p>
                    ) : null}
                    {s.notes?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-cream-600">{s.notes.trim()}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
