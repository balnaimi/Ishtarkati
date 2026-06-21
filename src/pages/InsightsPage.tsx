import { useCallback, useEffect, useMemo, useState } from "react";
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
import { arSA, enUS } from "date-fns/locale";
import {
  getPrimaryCurrencyCode,
  getSetting,
  batchUpdateSubscriptionQarSnapshots,
  loadPaymentHistoryByMonth,
  loadPaymentHistoryByYear,
  loadPaymentHistoryDetails,
  loadSubscriptionsForCashflow,
  type PaymentHistoryDetailRow,
  statsSummary,
  type SubscriptionListRow,
} from "../db/repo";
import { HomeCashflowCompact } from "../components/HomeCashflowCompact";
import { StatsGridSkeleton } from "../components/LoadingSkeleton";
import { mapSubsDueByDayInMonth, projectedTotalsByMonthIndex } from "../lib/cashflowProjection";
import {
  amountToPrimaryFromUsdBase,
  mergeRatesFromCacheJson,
  type UsdBasedRates,
} from "../lib/fx";
import { useFxManager } from "../hooks/useFx";

type MainTab = "summary" | "calendar" | "history";
type CalMode = "year" | "month";
type HistFilter = "month" | "subscription";
type HistSort = "desc" | "asc";

function weekdayHeaderKeys(): string[] {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
}

function chipClass(active: boolean): string {
  return `dash-chip ${active ? "dash-chip-active" : "dash-chip-idle"}`;
}

export function InsightsPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "en" ? enUS : arSA;
  const [tab, setTab] = useState<MainTab>("summary");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof statsSummary>> | null>(null);
  const [subs, setSubs] = useState<SubscriptionListRow[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [calMode, setCalMode] = useState<CalMode>("year");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth0, setCalMonth0] = useState(() => new Date().getMonth());
  const [histYears, setHistYears] = useState<{ year: string; total: number }[]>([]);
  const [histMonths, setHistMonths] = useState<{ ym: string; total: number }[]>([]);
  const [histPayments, setHistPayments] = useState<PaymentHistoryDetailRow[]>([]);
  const [histFilter, setHistFilter] = useState<HistFilter>("month");
  const [histMonth, setHistMonth] = useState("");
  const [histSubId, setHistSubId] = useState<number | "">("");
  const [histSort, setHistSort] = useState<HistSort>("desc");
  const { hydrate, refresh } = useFxManager();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sum, rows, prim] = await Promise.all([
      statsSummary(),
      loadSubscriptionsForCashflow(),
      getPrimaryCurrencyCode(),
    ]);
    setSummary(sum);
    setSubs(rows);
    setPrimaryCode(prim);
  }, []);

  const reloadHistory = useCallback(async () => {
    const [y, m, details] = await Promise.all([
      loadPaymentHistoryByYear(),
      loadPaymentHistoryByMonth(),
      loadPaymentHistoryDetails(),
    ]);
    setHistYears(y);
    setHistMonths(m);
    setHistPayments(details);
  }, []);

  useEffect(() => {
    void hydrate();
    void reload();
  }, [hydrate, reload]);

  useEffect(() => {
    if (tab !== "history") return;
    void reloadHistory();
  }, [tab, reloadHistory]);

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
      const rows = await loadSubscriptionsForCashflow();
      const updates: Array<{ id: number; qar: number; fxFactor: number; fxAt: string }> = [];
      for (const s of rows) {
        try {
          const { primary, fxFactor } = amountToPrimaryFromUsdBase(
            s.amount_original,
            s.currency_code,
            prim,
            rates,
            overrides,
          );
          updates.push({ id: s.id, qar: primary, fxFactor, fxAt });
        } catch {
          /* skip */
        }
      }
      await batchUpdateSubscriptionQarSnapshots(updates);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const monthTotals = projectedTotalsByMonthIndex(subs, calYear);
  const byDayMap = mapSubsDueByDayInMonth(subs, calYear, calMonth0);

  const monthAnchor = new Date(calYear, calMonth0, 1);
  const gridStart = startOfMonth(monthAnchor);
  const calStart = new Date(gridStart);
  const lead = getDay(gridStart);
  calStart.setDate(calStart.getDate() - lead);
  const calEnd = new Date(calStart);
  calEnd.setDate(calEnd.getDate() + 41);
  const daysGrid = eachDayOfInterval({ start: calStart, end: calEnd });

  const primary = summary?.primaryCode ?? primaryCode;
  const monthTitle = format(monthAnchor, "MMMM yyyy", { locale: dateLocale });

  const histSubsWithPayments = useMemo(() => {
    const seen = new Map<number, string>();
    for (const p of histPayments) {
      if (!seen.has(p.subscription_id)) seen.set(p.subscription_id, p.subscription_title);
    }
    return [...seen.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, i18n.language === "en" ? "en" : "ar"));
  }, [histPayments, i18n.language]);

  const filteredHistPayments = useMemo(() => {
    let rows = histPayments;
    if (histFilter === "month") {
      if (histMonth !== "") {
        rows = rows.filter((p) => p.paid_at.slice(0, 7) === histMonth);
      }
    } else if (histSubId !== "") {
      rows = rows.filter((p) => p.subscription_id === histSubId);
    }
    const dir = histSort === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const byDate = a.paid_at.localeCompare(b.paid_at) * dir;
      return byDate !== 0 ? byDate : (a.id - b.id) * dir;
    });
  }, [histPayments, histFilter, histMonth, histSubId, histSort]);

  const filteredHistTotal = useMemo(
    () => filteredHistPayments.reduce((s, p) => s + (p.amount_qar ?? 0), 0),
    [filteredHistPayments],
  );

  function shiftCalendar(delta: -1 | 1) {
    if (calMode === "year") {
      setCalYear((y) => y + delta);
      return;
    }
    const d = delta < 0
      ? subMonths(new Date(calYear, calMonth0, 1), 1)
      : addMonths(new Date(calYear, calMonth0, 1), 1);
    setCalYear(d.getFullYear());
    setCalMonth0(d.getMonth());
  }

  return (
    <div className="dash-page">
      <header>
        <h1 className="dash-page-title">{t("insights.title")}</h1>
        <p className="dash-page-sub">{t("insights.subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["summary", t("insights.tabSummary")] as const,
            ["calendar", t("insights.tabCalendar")] as const,
            ["history", t("insights.tabHistory")] as const,
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={chipClass(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <div className="space-y-4">
          {!summary ? (
            <StatsGridSkeleton />
          ) : (
            <>
              <div className="dash-home-stat-row">
                <article className="dash-home-stat">
                  <p className="dash-stat-label">{t("insights.dueThisMonth")}</p>
                  <p className="dash-stat-value">{summary.currentMonth.dueCount}</p>
                  <p className="mt-0.5 text-[11px] sk-text-hint">
                    {summary.currentMonth.totalPrimary.toFixed(0)} {primary}
                  </p>
                </article>
                <article className="dash-home-stat">
                  <p className="dash-stat-label">{t("insights.dueNextMonth")}</p>
                  <p className="dash-stat-value">{summary.nextMonth.dueCount}</p>
                  <p className="mt-0.5 text-[11px] sk-text-hint">
                    {summary.nextMonth.totalPrimary.toFixed(0)} {primary}
                  </p>
                </article>
                <article className="dash-home-stat">
                  <p className="dash-stat-label">{t("insights.due30")}</p>
                  <p className="dash-stat-value">{summary.due30Projected.dueCount}</p>
                  <p className="mt-0.5 text-[11px] sk-text-hint">
                    {summary.due30Projected.totalPrimary.toFixed(0)} {primary}
                  </p>
                </article>
                <article className="dash-home-stat">
                  <p className="dash-stat-label">{t("stats.recurringAccounts")}</p>
                  <p className="dash-stat-value">{summary.recurringCount}</p>
                  <p className="mt-0.5 text-[11px] sk-text-hint">{t("stats.recurringAccountsHint")}</p>
                </article>
              </div>

              <div className="dash-home-grid">
                <HomeCashflowCompact summary={summary} primaryCode={primary} />
                <section className="dash-home-panel">
                  <div className="dash-home-panel-head">
                    <div>
                      <h2 className="dash-card-title">{t("stats.refreshFx")}</h2>
                      <p className="mt-0.5 text-xs sk-text-hint">{t("insights.cashflowExplain")}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className="dash-btn-ghost !min-h-8 text-xs"
                      onClick={() => void recalcFxSnapshots()}
                    >
                      {t("stats.refreshFx")}
                    </button>
                  </div>
                  {msg ? <p className="px-3 pb-3 text-xs font-medium text-sage-800">{msg}</p> : null}
                  {summary.byCategory.length > 0 ? (
                    <div className="border-t border-cream-400/40 px-3 py-2.5">
                      <p className="text-[11px] font-semibold sk-text-hint">{t("insights.byCategoryThisMonth")}</p>
                      <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto">
                        {summary.byCategory.map((row) => (
                          <li key={row.name} className="flex justify-between gap-2 text-xs">
                            <span className="truncate text-cream-800">{row.name}</span>
                            <span className="shrink-0 font-medium text-cream-950">
                              {row.amountPrimary.toFixed(0)} {primary}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="space-y-3">
          <div className="dash-home-panel">
            <div className="dash-home-panel-head">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={chipClass(calMode === "year")} onClick={() => setCalMode("year")}>
                  {t("insights.calYear")}
                </button>
                <button type="button" className={chipClass(calMode === "month")} onClick={() => setCalMode("month")}>
                  {t("insights.calMonth")}
                </button>
              </div>
              <div className="dash-toolbar">
                <button type="button" className="dash-btn-ghost !min-h-8 px-2 text-xs" onClick={() => shiftCalendar(-1)}>
                  {t("insights.prev")}
                </button>
                <span className="text-xs font-medium text-cream-900">
                  {calMode === "year" ? t("insights.yearLabel", { year: calYear }) : monthTitle}
                </span>
                <button type="button" className="dash-btn-ghost !min-h-8 px-2 text-xs" onClick={() => shiftCalendar(1)}>
                  {t("insights.next")}
                </button>
              </div>
            </div>

            {calMode === "year" ? (
              <div className="dash-insights-year-grid p-3">
                {monthTotals.map((tot, i) => {
                  const label = format(new Date(calYear, i, 1), "MMMM", { locale: dateLocale });
                  return (
                    <button
                      key={i}
                      type="button"
                      className="dash-insights-year-cell"
                      onClick={() => {
                        setCalMonth0(i);
                        setCalMode("month");
                      }}
                    >
                      <p className="text-xs font-medium text-cream-800">{label}</p>
                      <p className="mt-0.5 text-sm font-bold text-cream-950">
                        {tot.toFixed(0)} {primaryCode}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2">
                <p className="mb-2 px-1 text-[11px] sk-text-hint">{t("insights.monthGridHint")}</p>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium sk-text-hint">
                  {weekdayHeaderKeys().map((k) => (
                    <div key={k} className="py-0.5">
                      {t(`insights.weekday.${k}`)}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {daysGrid.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const inMonth = isSameMonth(d, monthAnchor);
                    const entries = byDayMap.get(iso) ?? [];
                    const hasDue = entries.length > 0;
                    return (
                      <div
                        key={iso}
                        className={`sk-cal-day sk-cal-day-compact ${inMonth ? "" : "sk-cal-day-outside"} ${hasDue ? "sk-cal-day-due" : ""}`}
                      >
                        <div className="font-semibold text-cream-900">{format(d, "d")}</div>
                        <ul className="mt-0.5 space-y-0">
                          {entries.slice(0, 2).map((e) => (
                            <li key={`${e.subId}-${e.title}`} className="truncate leading-tight">
                              <Link className="text-sage-800 underline-offset-2 hover:underline" to={`/sub/${e.subId}`}>
                                {e.title}
                              </Link>
                            </li>
                          ))}
                          {entries.length > 2 ? (
                            <li className="sk-text-hint">+{entries.length - 2}</li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="space-y-3">
          {histPayments.length === 0 ? (
            <p className="dash-home-panel px-4 py-6 text-sm sk-text-hint">{t("insights.historyEmpty")}</p>
          ) : (
            <>
              <section className="dash-home-panel">
                <div className="dash-home-panel-head">
                  <p className="text-xs sk-text-hint">{t("insights.historyExplain")}</p>
                </div>
                <div className="space-y-2 border-b border-cream-400/40 px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={chipClass(histFilter === "month")} onClick={() => setHistFilter("month")}>
                      {t("insights.historyFilterMonth")}
                    </button>
                    <button type="button" className={chipClass(histFilter === "subscription")} onClick={() => setHistFilter("subscription")}>
                      {t("insights.historyFilterSub")}
                    </button>
                  </div>
                  {histFilter === "month" ? (
                    <select
                      id="hist-month-pick"
                      className="sk-select !min-h-9 text-sm"
                      value={histMonth}
                      onChange={(e) => setHistMonth(e.target.value)}
                    >
                      <option value="">{t("insights.historyAllMonths")}</option>
                      {histMonths.map((row) => {
                        const [y, m] = row.ym.split("-").map(Number);
                        const label = format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: dateLocale });
                        return (
                          <option key={row.ym} value={row.ym}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <select
                      id="hist-sub-pick"
                      className="sk-select !min-h-9 text-sm"
                      value={histSubId === "" ? "" : String(histSubId)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHistSubId(v === "" ? "" : Number(v));
                      }}
                    >
                      <option value="">{t("insights.historyAllSubs")}</option>
                      {histSubsWithPayments.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={chipClass(histSort === "desc")} onClick={() => setHistSort("desc")}>
                      {t("insights.historySortNewest")}
                    </button>
                    <button type="button" className={chipClass(histSort === "asc")} onClick={() => setHistSort("asc")}>
                      {t("insights.historySortOldest")}
                    </button>
                  </div>
                  <p className="text-xs text-cream-800">
                    {t("insights.historyPaymentsCount", { count: filteredHistPayments.length })}
                    {filteredHistPayments.length > 0 ? (
                      <>
                        {" — "}
                        {t("insights.historyPaymentsTotal", {
                          amount: filteredHistTotal.toFixed(2),
                          code: primaryCode,
                        })}
                      </>
                    ) : null}
                  </p>
                </div>

                {filteredHistPayments.length === 0 ? (
                  <p className="px-4 py-4 text-sm sk-text-hint">{t("insights.historyEmptyFilter")}</p>
                ) : (
                  <ul className="max-h-[22rem] divide-y divide-cream-400/40 overflow-y-auto">
                    {filteredHistPayments.map((p) => {
                      const paidLabel = format(new Date(p.paid_at.slice(0, 10)), "d MMM yyyy", {
                        locale: dateLocale,
                      });
                      const primaryAmt = p.amount_qar ?? p.amount_original ?? 0;
                      const showOrig =
                        p.amount_original != null &&
                        p.currency &&
                        p.currency.toUpperCase() !== primaryCode.toUpperCase();
                      return (
                        <li key={p.id} className="dash-list-row">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-cream-950">{p.subscription_title}</p>
                            <p className="sk-text-hint">{paidLabel}</p>
                          </div>
                          <div className="shrink-0 text-end">
                            <p className="font-semibold text-sage-800">
                              {primaryAmt.toFixed(2)} {primaryCode}
                            </p>
                            {showOrig ? (
                              <p className="sk-text-hint">
                                {p.amount_original!.toFixed(2)} {p.currency}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <details className="dash-home-panel text-sm">
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-cream-950">
                  {t("insights.historyTotalsFold")}
                </summary>
                <div className="grid gap-4 border-t border-cream-400/40 px-3 py-2 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 text-xs font-semibold sk-text-hint">{t("insights.historyByYear")}</h4>
                    <ul className="max-h-36 space-y-0.5 overflow-y-auto">
                      {histYears.map((row) => (
                        <li key={row.year} className="flex justify-between gap-2 text-xs py-0.5">
                          <span>{row.year}</span>
                          <span className="font-medium text-sage-800">
                            {row.total.toFixed(2)} {primaryCode}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs font-semibold sk-text-hint">{t("insights.historyByMonth")}</h4>
                    <ul className="max-h-36 space-y-0.5 overflow-y-auto">
                      {histMonths.map((row) => (
                        <li key={row.ym} className="flex justify-between gap-2 text-xs py-0.5">
                          <span dir="ltr" className="font-mono">
                            {row.ym}
                          </span>
                          <span className="font-medium text-sage-800">
                            {row.total.toFixed(2)} {primaryCode}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
