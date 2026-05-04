import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  statsSummary,
  loadSubscriptions,
  updateSubscriptionQarSnapshot,
  getSetting,
} from "../db/repo";
import { useFxManager } from "../hooks/useFx";
import { amountToQarFromUsdBase, type UsdBasedRates } from "../lib/fx";

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
      await refresh();
      const cacheRaw = await getSetting("fx_rates_cache");
      const ovrRaw = await getSetting("fx_overrides_json");
      if (!cacheRaw) {
        setMsg(t("fx.fetchError"));
        return;
      }
      let rates: UsdBasedRates;
      let fxAt: string;
      try {
        const parsed = JSON.parse(cacheRaw) as {
          rates: UsdBasedRates;
          fetchedAt: string;
        };
        rates = parsed.rates;
        fxAt = parsed.fetchedAt;
      } catch {
        setMsg(t("fx.fetchError"));
        return;
      }
      let overrides: Record<string, number> | null = null;
      if (ovrRaw) {
        try {
          overrides = JSON.parse(ovrRaw) as Record<string, number>;
        } catch {
          overrides = null;
        }
      }
      const subs = await loadSubscriptions({});
      for (const s of subs) {
        try {
          const { qar, fxFactor } = amountToQarFromUsdBase(
            s.amount_original,
            s.currency_code,
            rates,
            overrides,
          );
          await updateSubscriptionQarSnapshot(s.id, qar, fxFactor, fxAt);
        } catch {
          /* skip unknown currency */
        }
      }
      setMsg(t("fx.updated"));
      await reload();
      void hydrate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">{t("stats.title")}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700 disabled:opacity-50"
          onClick={() => void recalcAll()}
        >
          {t("stats.refreshFx")}
        </button>
        {msg ? <span className="text-sm text-emerald-400">{msg}</span> : null}
      </div>

      {!summary ? (
        <p className="text-slate-400">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-400">{t("stats.monthlyEstimate")}</p>
            <p className="text-2xl font-semibold text-emerald-300">
              {summary.monthlyEstimate.toFixed(2)} QAR
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t("stats.subscriptions")}: {summary.recurringCount}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-400">{t("stats.due30")}</p>
            <p className="text-2xl font-semibold text-amber-300">
              {summary.due30Total.toFixed(2)} QAR
            </p>
          </div>
          <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="mb-2 text-sm text-slate-400">{t("stats.byCategory")}</p>
            <ul className="space-y-1">
              {summary.byCategory.length === 0 ? (
                <li className="text-slate-500">{t("common.none")}</li>
              ) : (
                summary.byCategory.map((row) => (
                  <li key={row.name} className="flex justify-between text-sm text-slate-300">
                    <span>{row.name}</span>
                    <span className="text-emerald-300">{row.monthlyQar.toFixed(2)} QAR / شهريًا</span>
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
