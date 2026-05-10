import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  statsSummary,
  loadSubscriptions,
  updateSubscriptionQarSnapshot,
  getSetting,
  getPrimaryCurrencyCode,
} from "../db/repo";
import { useFxManager } from "../hooks/useFx";
import {
  amountToPrimaryFromUsdBase,
  mergeRatesFromCacheJson,
  type UsdBasedRates,
} from "../lib/fx";

export function StatsPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const { hydrate, refresh } = useFxManager();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setSummary(await statsSummary());
  }, []);

  useEffect(() => {
    void hydrate();
    void reload();
  }, [hydrate, reload]);

  async function recalcAll() {
    setBusy(true);
    setMsg(null);
    try {
      try {
        await refresh();
        setMsg(t("fx.updated"));
      } catch {
        setMsg(t("fx.offlineKeepBuiltin"));
      }
      const cacheRaw = await getSetting("fx_rates_cache");
      const ovrRaw = await getSetting("fx_overrides_json");
      const rates: UsdBasedRates = mergeRatesFromCacheJson(cacheRaw);
      let fxAt = new Date().toISOString();
      if (cacheRaw) {
        try {
          const p = JSON.parse(cacheRaw) as { fetchedAt?: string };
          if (p.fetchedAt) fxAt = p.fetchedAt;
        } catch {
          /* ignore */
        }
      }
      let overrides: Record<string, number> | null = null;
      if (ovrRaw) {
        try {
          overrides = JSON.parse(ovrRaw) as Record<string, number>;
        } catch {
          overrides = null;
        }
      }
      const prim = await getPrimaryCurrencyCode();
      const subs = await loadSubscriptions({});
      for (const s of subs) {
        try {
          const { primary, fxFactor } = amountToPrimaryFromUsdBase(
            s.amount_original,
            s.currency_code,
            prim,
            rates,
            overrides,
          );
          await updateSubscriptionQarSnapshot(s.id, primary, fxFactor, fxAt);
        } catch {
          /* skip unknown currency */
        }
      }
      await reload();
      void hydrate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-cream-900">{t("stats.title")}</h2>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          className="sk-btn-secondary"
          onClick={() => void recalcAll()}
        >
          {t("stats.refreshFx")}
        </button>
        {msg ? <span className="text-sm font-medium text-sage-800">{msg}</span> : null}
      </div>

      {!summary ? (
        <p className="text-cream-700">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="sk-card">
            <p className="text-sm font-medium text-cream-700">{t("stats.monthlyEstimate")}</p>
            <p className="mt-2 text-2xl font-semibold text-sage-800">
              {summary.monthlyEstimate.toFixed(2)} {summary.primaryCode}
            </p>
            <p className="mt-4 text-sm font-medium text-cream-700">{t("stats.yearlyEstimate")}</p>
            <p className="mt-2 text-xl font-semibold text-sage-800">
              {summary.yearlyEstimate.toFixed(2)} {summary.primaryCode}
            </p>
            <p className="mt-2 text-xs text-cream-600">{t("stats.yearlyFromMonthlyHint")}</p>
            <p className="mt-3 text-sm text-cream-600">
              {t("stats.subscriptions")}: {summary.recurringCount}
            </p>
          </div>
          <div className="sk-card">
            <p className="text-sm font-medium text-cream-700">{t("stats.due30")}</p>
            <p className="mt-2 text-2xl font-semibold text-walnut-600">
              {summary.due30Total.toFixed(2)} {summary.primaryCode}
            </p>
          </div>
          <div className="md:col-span-2 sk-card">
            <p className="mb-3 text-sm font-medium text-cream-700">{t("stats.byCategory")}</p>
            <ul className="space-y-2">
              {summary.byCategory.length === 0 ? (
                <li className="text-cream-600">{t("common.none")}</li>
              ) : (
                summary.byCategory.map((row) => (
                  <li key={row.name} className="flex flex-wrap justify-between gap-2 text-sm text-cream-800">
                    <span>{row.name}</span>
                    <span className="font-medium text-sage-800">
                      {row.monthlyPrimary.toFixed(2)} {summary.primaryCode} / {t("stats.perMonth")}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
