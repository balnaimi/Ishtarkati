import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getPrimaryCurrencyCode,
  loadSubscriptionsCancelled,
  reactivateSubscription,
  type SubscriptionListRow,
} from "../db/repo";
import { DualCurrencyAmounts } from "../components/DualCurrencyAmounts";
import { SiteFavicon } from "../components/SiteFavicon";

export function CancelledSubscriptionsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [rows, setRows] = useState<SubscriptionListRow[]>([]);
  const [primary, setPrimary] = useState("QAR");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, prim] = await Promise.all([loadSubscriptionsCancelled(), getPrimaryCurrencyCode()]);
      setRows(list);
      setPrimary(prim);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onReactivate(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await reactivateSubscription(id);
    void reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("cancelled.title")}</h2>
          <p className="mt-1 text-sm text-cream-700">{t("cancelled.subtitle")}</p>
        </div>
        <Link to="/list" className="sk-btn-secondary px-4 py-2.5 text-center text-sm">
          {t("cancelled.backToActive")}
        </Link>
      </div>

      {loading ? (
        <p className="sk-text-hint">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="sk-text-hint">{t("cancelled.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li
              key={s.id}
              className="sk-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-start"
                onClick={() => nav(`/sub/${s.id}`)}
              >
                <span className="flex w-full items-start justify-start gap-2">
                  {s.website_url?.trim() ? (
                    <SiteFavicon websiteUrl={s.website_url} size="sm" className="mt-0.5 shrink-0" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-cream-950">{s.title}</span>
                    {s.account_label?.trim() ? (
                      <span className="mt-0.5 block text-xs text-cream-600">{s.account_label.trim()}</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-cream-600">
                      {t("cancelled.markedOn", { date: s.cancelled_at ?? "—" })}
                    </span>
                    <div className="mt-2 text-xs">
                      <DualCurrencyAmounts
                        size="sm"
                        originalAmount={s.amount_original}
                        originalCode={s.currency_code}
                        approxAmount={s.amount_qar_snapshot}
                        approxCode={primary}
                      />
                    </div>
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="sk-btn-primary text-sm"
                  onClick={(e) => void onReactivate(e, s.id)}
                >
                  {t("cancelled.reactivate")}
                </button>
                <Link to={`/sub/${s.id}`} className="sk-btn-secondary text-sm">
                  {t("common.details")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
