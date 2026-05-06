import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmSubscriptionPaid,
  loadSubscriptions,
  loadSubscriptionsDueSoon,
  loadSubscriptionsRecent,
  statsSummary,
  subscriptionNeedsPaidAttention,
  type SubscriptionListRow,
} from "../db/repo";
import { DueProgressBar } from "../components/DueProgressBar";
import { DualCurrencyAmounts } from "../components/DualCurrencyAmounts";
import {
  computeDueProgress,
  dueListRowHighlightClass,
  dueProgressTone,
  relativeDueCaption,
  type DueProgressInput,
  type DueTone,
} from "../lib/dueProgress";

function toneTextClass(tone: DueTone): string {
  if (tone === "overdue" || tone === "due") return "text-red-800";
  if (tone === "urgent") return "text-orange-900";
  if (tone === "warn") return "text-amber-900";
  return "text-sage-800";
}

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

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, d, r, all] = await Promise.all([
        statsSummary(),
        loadSubscriptionsDueSoon(5),
        loadSubscriptionsRecent(5),
        loadSubscriptions({}),
      ]);
      setSummary(sum);
      setDueSoon(d);
      setRecent(r);
      setAttentionAll(all.filter(subscriptionNeedsPaidAttention));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attentionList = attentionAll;

  async function onConfirmPaid(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await confirmSubscriptionPaid(id);
    void reload();
  }

  function billingLabel(model: string) {
    if (model === "one_time") return t("billing.one_time");
    return t("billing.recurring");
  }

  const primary = summary?.primaryCode ?? "QAR";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("home.dashboardTitle")}</h2>
          <p className="text-sm text-cream-600">{t("home.dashboardSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/new" className="sk-btn-warm px-5 py-2.5 text-center font-semibold shadow-sm">
            {t("home.addSubscriptionCta")}
          </Link>
          <Link to="/list" className="sk-btn-secondary px-4 py-2.5 text-center">
            {t("home.allSubscriptions")}
          </Link>
        </div>
      </div>

      {attentionList.length > 0 ? (
        <div
          className="rounded-xl border border-amber-400/90 bg-amber-50/90 px-4 py-3 text-amber-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold">{t("home.attentionBannerTitle")}</p>
          <ul className="mt-2 list-inside list-disc text-sm">
            {attentionList.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="font-medium text-walnut-700 underline-offset-2 hover:underline"
                  onClick={() => nav(`/sub/${s.id}`)}
                >
                  {s.title}
                </button>
                {" — "}
                {t("home.attentionLine", { date: s.next_due_date ?? "" })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading || !summary ? (
        <p className="text-cream-700">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="sk-card">
            <p className="text-sm font-medium text-cream-700">{t("stats.monthlyEstimate")}</p>
            <p className="mt-2 text-2xl font-semibold text-sage-800">
              {summary.monthlyEstimate.toFixed(2)} {primary}
            </p>
            <p className="mt-3 text-sm text-cream-600">
              {t("stats.subscriptions")}: {summary.recurringCount}
            </p>
          </div>
          <div className="sk-card">
            <p className="text-sm font-medium text-cream-700">{t("stats.due30")}</p>
            <p className="mt-2 text-2xl font-semibold text-walnut-600">
              {summary.due30Total.toFixed(2)} {primary}
            </p>
          </div>
          <div className="md:col-span-2 sk-card">
            <p className="mb-3 text-sm font-medium text-cream-700">{t("stats.byCategory")}</p>
            <ul className="space-y-2">
              {summary.byCategory.length === 0 ? (
                <li className="text-cream-600">{t("common.none")}</li>
              ) : (
                summary.byCategory.map((row) => (
                  <li
                    key={row.name}
                    className="flex flex-wrap justify-between gap-2 text-sm text-cream-800"
                  >
                    <span>{row.name}</span>
                    <span className="font-medium text-sage-800">
                      {row.monthlyPrimary.toFixed(2)} {primary} / {t("stats.perMonth")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-cream-900">{t("home.nearestDue")}</h3>
        <ul className="space-y-3">
          {dueSoon.length === 0 ? (
            <li className="text-cream-600">{t("home.noDueSoon")}</li>
          ) : (
            dueSoon.map((s) => {
              const prog = s.next_due_date ? computeDueProgress(progressInput(s)) : null;
              const tone = prog ? dueProgressTone(prog) : null;
              const needsPaid = subscriptionNeedsPaidAttention(s);
              return (
                <li
                  key={s.id}
                  className={`sk-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                    needsPaid ? "ring-2 ring-amber-500/80" : ""
                  } ${tone ? dueListRowHighlightClass(tone) : ""}`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-right"
                    onClick={() => nav(`/sub/${s.id}`)}
                  >
                    <span className="font-semibold text-sage-900">{s.title}</span>
                    <span className="mt-1 block text-sm text-cream-700">
                      {s.next_due_date ?? "—"} · {billingLabel(s.billing_model)}
                    </span>
                    {prog && tone ? (
                      <span className={`mt-1 block text-xs font-medium ${toneTextClass(tone)}`}>
                        {relativeDueCaption(t, prog)}
                      </span>
                    ) : null}
                    {s.next_due_date ? (
                      <div className="mt-2 max-w-md">
                        <DueProgressBar sub={progressInput(s)} size="sm" showCaption={false} />
                      </div>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {needsPaid ? (
                      <button
                        type="button"
                        className="sk-btn-primary text-sm"
                        onClick={(e) => void onConfirmPaid(e, s.id)}
                      >
                        {t("home.markPaid")}
                      </button>
                    ) : null}
                    <Link to={`/sub/${s.id}/edit`} className="sk-btn-secondary text-sm">
                      {t("common.edit")}
                    </Link>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-cream-900">{t("home.recentAdded")}</h3>
        <ul className="space-y-2">
          {recent.length === 0 ? (
            <li className="text-cream-600">{t("common.none")}</li>
          ) : (
            recent.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-cream-400 bg-cream-50/95 px-4 py-3 text-right shadow-sm hover:bg-cream-200/50"
                  onClick={() => nav(`/sub/${s.id}`)}
                >
                  <span className="font-medium text-sage-900">{s.title}</span>
                  <div className="mt-1.5 text-xs">
                    <DualCurrencyAmounts
                      size="sm"
                      originalAmount={s.amount_original}
                      originalCode={s.currency_code}
                      approxAmount={s.amount_qar_snapshot}
                      approxCode={primary}
                    />
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
