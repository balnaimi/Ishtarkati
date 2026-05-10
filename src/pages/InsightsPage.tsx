import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addMonths,
  eachDayOfInterval,
  format,
  getDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { arSA } from "date-fns/locale";
import {
  getPrimaryCurrencyCode,
  getSetting,
  loadPaymentHistoryByMonth,
  loadPaymentHistoryByYear,
  loadSubscriptions,
  statsSummary,
  updateSubscriptionQarSnapshot,
  type SubscriptionListRow,
} from "../db/repo";
import { mapSubsDueByDayInMonth, projectedTotalsByMonthIndex } from "../lib/cashflowProjection";
import {
  amountToPrimaryFromUsdBase,
  mergeRatesFromCacheJson,
  type UsdBasedRates,
} from "../lib/fx";
import { useFxManager } from "../hooks/useFx";

type MainTab = "summary" | "calendar" | "history";
type CalMode = "year" | "month";

function weekdayHeaderKeys(): string[] {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
}

export function InsightsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<MainTab>("summary");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const [subs, setSubs] = useState<SubscriptionListRow[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [calMode, setCalMode] = useState<CalMode>("year");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth0, setCalMonth0] = useState(() => new Date().getMonth());
  const [histYears, setHistYears] = useState<{ year: string; total: number }[]>([]);
  const [histMonths, setHistMonths] = useState<{ ym: string; total: number }[]>([]);
  const { hydrate, refresh } = useFxManager();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sum, rows, prim] = await Promise.all([
      statsSummary(),
      loadSubscriptions({}),
      getPrimaryCurrencyCode(),
    ]);
    setSummary(sum);
    setSubs(rows);
    setPrimaryCode(prim);
  }, []);

  const reloadHistory = useCallback(async () => {
    const [y, m] = await Promise.all([loadPaymentHistoryByYear(), loadPaymentHistoryByMonth()]);
    setHistYears(y);
    setHistMonths(m);
  }, []);

  useEffect(() => {
    void hydrate();
    void reload();
    void reloadHistory();
  }, [hydrate, reload, reloadHistory]);

  async function recalcFxSnapshots() {
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
      const rows = await loadSubscriptions({});
      for (const s of rows) {
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
          /* skip */
        }
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const monthTotals = projectedTotalsByMonthIndex(subs, calYear);
  const byDayMap = mapSubsDueByDayInMonth(subs, calYear, calMonth0);

  const monthAnchor = new Date(calYear, calMonth0, 1);
  const gridStart = startOfMonth(monthAnchor);
  /** Sunday-aligned 6×7 grid start */
  const calStart = new Date(gridStart);
  const lead = getDay(gridStart);
  calStart.setDate(calStart.getDate() - lead);
  const calEnd = new Date(calStart);
  calEnd.setDate(calEnd.getDate() + 41);
  const daysGrid = eachDayOfInterval({ start: calStart, end: calEnd });

  const primary = summary?.primaryCode ?? primaryCode;

  const monthTitle = format(monthAnchor, "MMMM yyyy", { locale: arSA });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("insights.title")}</h2>
          <p className="sk-text-hint mt-1 text-sm">{t("insights.subtitle")}</p>
        </div>
        <Link to="/" className="sk-btn-secondary px-4 py-2.5 text-center text-sm">
          {t("insights.backHome")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-cream-400 pb-3">
        {(
          [
            ["summary", t("insights.tabSummary")] as const,
            ["calendar", t("insights.tabCalendar")] as const,
            ["history", t("insights.tabHistory")] as const,
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === id ? "bg-cream-800 text-cream-50" : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              className="sk-btn-secondary"
              onClick={() => void recalcFxSnapshots()}
            >
              {t("stats.refreshFx")}
            </button>
            {msg ? <span className="text-sm font-medium text-sage-800">{msg}</span> : null}
          </div>

          {!summary ? (
            <p className="text-cream-700">{t("common.loading")}</p>
          ) : (
            <>
              <p className="text-sm text-cream-700">{t("insights.cashflowExplain")}</p>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="sk-card">
                  <p className="text-sm font-medium text-cream-700">{t("insights.dueThisMonth")}</p>
                  <p className="mt-1 text-xs text-cream-600">
                    {t("insights.monthNumbered", {
                      month: summary.currentMonth.month,
                      year: summary.currentMonth.year,
                    })}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-sage-800">
                    {summary.currentMonth.totalPrimary.toFixed(2)} {primary}
                  </p>
                  <p className="sk-text-hint mt-2 text-xs">
                    {t("insights.dueEvents", { count: summary.currentMonth.dueCount })}
                  </p>
                </div>
                <div className="sk-card">
                  <p className="text-sm font-medium text-cream-700">{t("insights.dueNextMonth")}</p>
                  <p className="mt-1 text-xs text-cream-600">
                    {t("insights.monthNumbered", {
                      month: summary.nextMonth.month,
                      year: summary.nextMonth.year,
                    })}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-sage-800">
                    {summary.nextMonth.totalPrimary.toFixed(2)} {primary}
                  </p>
                  <p className="sk-text-hint mt-2 text-xs">
                    {t("insights.dueEvents", { count: summary.nextMonth.dueCount })}
                  </p>
                </div>
                <div className="sk-card">
                  <p className="text-sm font-medium text-cream-700">{t("insights.projectedYear")}</p>
                  <p className="mt-1 text-xs text-cream-600">
                    {t("insights.yearLabel", { year: summary.currentYearProjected.year })}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-sage-800">
                    {summary.currentYearProjected.totalPrimary.toFixed(2)} {primary}
                  </p>
                  <p className="sk-text-hint mt-2 text-xs">
                    {t("insights.dueEvents", { count: summary.currentYearProjected.dueCount })}
                  </p>
                </div>
                <div className="sk-card">
                  <p className="text-sm font-medium text-cream-700">{t("insights.due30")}</p>
                  <p className="mt-2 text-2xl font-semibold text-walnut-600">
                    {summary.due30Projected.totalPrimary.toFixed(2)} {primary}
                  </p>
                  <p className="sk-text-hint mt-2 text-xs">
                    {t("insights.dueEvents", { count: summary.due30Projected.dueCount })}
                  </p>
                </div>
                <div className="md:col-span-2 sk-card">
                  <p className="mb-2 text-sm font-medium text-cream-700">{t("stats.subscriptions")}</p>
                  <p className="text-sm text-cream-800">{summary.recurringCount}</p>
                </div>
                <div className="md:col-span-2 sk-card">
                  <p className="mb-3 text-sm font-medium text-cream-700">{t("insights.byCategoryThisMonth")}</p>
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
                            {row.amountPrimary.toFixed(2)} {primary}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                calMode === "year"
                  ? "bg-cream-800 text-cream-50"
                  : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
              }`}
              onClick={() => setCalMode("year")}
            >
              {t("insights.calYear")}
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                calMode === "month"
                  ? "bg-cream-800 text-cream-50"
                  : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
              }`}
              onClick={() => setCalMode("month")}
            >
              {t("insights.calMonth")}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="sk-btn-secondary text-sm"
              onClick={() => {
                if (calMode === "year") setCalYear((y) => y - 1);
                else {
                  const d = subMonths(new Date(calYear, calMonth0, 1), 1);
                  setCalYear(d.getFullYear());
                  setCalMonth0(d.getMonth());
                }
              }}
            >
              {t("insights.prev")}
            </button>
            <button
              type="button"
              className="sk-btn-secondary text-sm"
              onClick={() => {
                if (calMode === "year") setCalYear((y) => y + 1);
                else {
                  const d = addMonths(new Date(calYear, calMonth0, 1), 1);
                  setCalYear(d.getFullYear());
                  setCalMonth0(d.getMonth());
                }
              }}
            >
              {t("insights.next")}
            </button>
            <span className="text-sm font-medium text-cream-800">
              {calMode === "year"
                ? t("insights.yearLabel", { year: calYear })
                : monthTitle}
            </span>
          </div>

          {calMode === "year" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {monthTotals.map((tot, i) => {
                const label = format(new Date(calYear, i, 1), "MMM", { locale: arSA });
                return (
                  <button
                    key={i}
                    type="button"
                    className="sk-card text-right transition hover:border-sage-500/50"
                    onClick={() => {
                      setCalMonth0(i);
                      setCalMode("month");
                    }}
                  >
                    <p className="text-sm font-medium text-cream-800">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-sage-800">
                      {tot.toFixed(2)} {primaryCode}
                    </p>
                    <p className="sk-text-hint mt-1 text-xs">{t("insights.tapForMonth")}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-cream-700">{t("insights.monthGridHint")}</p>
              <div className="sk-card overflow-x-auto">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-cream-600">
                  {weekdayHeaderKeys().map((k) => (
                    <div key={k} className="py-1">
                      {t(`insights.weekday.${k}`)}
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {daysGrid.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const inMonth = isSameMonth(d, monthAnchor);
                    const entries = byDayMap.get(iso) ?? [];
                    return (
                      <div
                        key={iso}
                        className={`min-h-[4.5rem] rounded-md border p-1 text-[11px] ${
                          inMonth
                            ? "border-cream-400 bg-cream-50/90"
                            : "border-cream-300/50 bg-cream-100/40 opacity-70"
                        }`}
                      >
                        <div className="font-semibold text-cream-900">{format(d, "d")}</div>
                        <ul className="mt-0.5 space-y-0.5">
                          {entries.slice(0, 3).map((e) => (
                            <li key={`${e.subId}-${e.title}`} className="truncate leading-tight text-cream-700">
                              <Link className="text-sage-800 underline-offset-2 hover:underline" to={`/sub/${e.subId}`}>
                                {e.title}
                              </Link>
                              <span className="text-cream-600">
                                {" "}
                                {e.amountPrimary.toFixed(0)} {primaryCode}
                              </span>
                            </li>
                          ))}
                          {entries.length > 3 ? (
                            <li className="text-cream-600">+{entries.length - 3}</li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="space-y-8">
          <p className="text-sm text-cream-700">{t("insights.historyExplain")}</p>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("insights.historyByYear")}</h3>
            {histYears.length === 0 ? (
              <p className="text-sm text-cream-600">{t("insights.historyEmpty")}</p>
            ) : (
              <ul className="space-y-3">
                {histYears.map((row, idx) => {
                  const older = histYears[idx + 1];
                  let hint = "";
                  if (older) {
                    const d = row.total - older.total;
                    const pct = older.total > 0 ? (d / older.total) * 100 : null;
                    if (pct != null && Math.abs(pct) > 0.05) {
                      hint =
                        d >= 0
                          ? t("insights.historyTrendUp", { pct: pct.toFixed(1) })
                          : t("insights.historyTrendDown", { pct: Math.abs(pct).toFixed(1) });
                    } else if (Math.abs(d) > 0.01) {
                      hint = d >= 0 ? t("insights.historyTrendUpFlat") : t("insights.historyTrendDownFlat");
                    }
                  }
                  return (
                    <li
                      key={row.year}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cream-300/60 pb-2 text-sm"
                    >
                      <span className="font-medium text-cream-900">{row.year}</span>
                      <div className="text-end">
                        <span className="font-semibold text-sage-800">
                          {row.total.toFixed(2)} {primaryCode}
                        </span>
                        {hint ? <p className="sk-text-hint text-xs">{hint}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="sk-card space-y-4">
            <h3 className="text-base font-semibold text-cream-900">{t("insights.historyByMonth")}</h3>
            {histMonths.length === 0 ? (
              <p className="text-sm text-cream-600">{t("insights.historyEmpty")}</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {histMonths.map((row, idx) => {
                  const older = histMonths[idx + 1];
                  let deltaHint = "";
                  if (older) {
                    const d = row.total - older.total;
                    if (Math.abs(d) > 0.01) {
                      deltaHint =
                        d >= 0
                          ? t("insights.historyMonthDeltaUp", { amount: d.toFixed(2) })
                          : t("insights.historyMonthDeltaDown", { amount: Math.abs(d).toFixed(2) });
                    }
                  }
                  return (
                    <li
                      key={row.ym}
                      className="flex flex-wrap justify-between gap-2 border-b border-cream-200/80 py-1"
                    >
                      <span dir="ltr" className="font-mono text-cream-800">
                        {row.ym}
                      </span>
                      <div className="text-end">
                        <span className="font-medium text-sage-800">
                          {row.total.toFixed(2)} {primaryCode}
                        </span>
                        {deltaHint ? <p className="sk-text-hint text-xs">{deltaHint}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
