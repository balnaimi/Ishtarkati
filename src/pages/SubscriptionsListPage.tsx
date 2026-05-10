import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loadSubscriptions,
  loadCategories,
  getPrimaryCurrencyCode,
  type AppCurrency,
  type SubscriptionListRow,
} from "../db/repo";
import { useFxManager } from "../hooks/useFx";
import { DueProgressBar } from "../components/DueProgressBar";
import { DualCurrencyAmounts } from "../components/DualCurrencyAmounts";
import { SiteFavicon } from "../components/SiteFavicon";
import {
  computeDueProgress,
  dueListRowHighlightClass,
  dueProgressTone,
  relativeDueCaption,
  type DueProgressInput,
  type DueTone,
} from "../lib/dueProgress";
import { subscriptionBillingPeriodLine } from "../lib/billingPeriodLabel";

function toneTextClass(tone: DueTone): string {
  if (tone === "overdue" || tone === "due") return "sk-tone-due-bar-critical";
  if (tone === "urgent") return "sk-tone-due-urgent";
  if (tone === "warn") return "sk-tone-due-bar-warn";
  return "sk-tone-due-safe";
}

type SortKey = "next_due" | "title" | "category" | "amount" | "primary";

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

/** Full sortable/filterable subscription table (moved from old home). */
export function SubscriptionsListPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const filterDetailsRef = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<SubscriptionListRow[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<AppCurrency[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [catFilter, setCatFilter] = useState<string>("");
  const [curFilter, setCurFilter] = useState<string>("");
  const [dueSoon, setDueSoon] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortKey, setSortKey] = useState<SortKey>("next_due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const { hydrate } = useFxManager();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const q = deferredSearch.trim();
      const [list, cats, curs, prim] = await Promise.all([
        loadSubscriptions({
          categoryId: catFilter ? parseInt(catFilter, 10) : undefined,
          currency: curFilter || undefined,
          dueWithinDays: dueSoon ? 30 : undefined,
          search: q || undefined,
        }),
        loadCategories(),
        loadSubscriptions({}).then((rows) => {
          const codes = [...new Set(rows.map((r) => r.currency_code))].sort();
          return codes.map((code, i) => ({ code, sort_order: i }));
        }),
        getPrimaryCurrencyCode(),
      ]);
      setItems(list);
      setCategories(cats);
      setCurrencyOptions(curs);
      setPrimaryCode(prim);
    } finally {
      setLoading(false);
    }
  }, [catFilter, curFilter, dueSoon, deferredSearch]);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const mul = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "next_due":
          if (!a.next_due_date && !b.next_due_date) return 0;
          if (!a.next_due_date) return 1;
          if (!b.next_due_date) return -1;
          return a.next_due_date.localeCompare(b.next_due_date) * mul;
        case "title":
          return a.title.localeCompare(b.title, "ar") * mul;
        case "category":
          return (a.category_name ?? "").localeCompare(b.category_name ?? "", "ar") * mul;
        case "amount":
          return (a.amount_original - b.amount_original) * mul;
        case "primary": {
          const aq = a.amount_qar_snapshot ?? -Infinity;
          const bq = b.amount_qar_snapshot ?? -Infinity;
          return (aq - bq) * mul;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [items, sortKey, sortDir]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (filterDetailsRef.current) filterDetailsRef.current.open = true;
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function billingLabel(model: string) {
    if (model === "one_time") return t("billing.one_time");
    return t("billing.recurring");
  }

  function billingCell(s: SubscriptionListRow) {
    const period = subscriptionBillingPeriodLine(s, t);
    return (
      <div className="space-y-0.5">
        <span className="block">{billingLabel(s.billing_model)}</span>
        {period ? <span className="block text-xs text-cream-600">{period}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-cream-900">{t("list.title")}</h2>
        <Link to="/" className="text-sm font-medium text-sage-800 underline-offset-2 hover:underline">
          ← {t("home.dashboardTitle")}
        </Link>
      </div>

      <details ref={filterDetailsRef} className="sk-card overflow-hidden p-0 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-cream-900 outline-none transition-colors hover:bg-cream-200/30 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-cream-500" aria-hidden>
              ▾
            </span>
            <span className="truncate">{t("list.filtersToggle")}</span>
          </span>
          <span className="hidden shrink-0 text-[11px] font-normal text-cream-600 sm:inline">
            {t("list.filtersToggleHint")}
          </span>
        </summary>

        <div className="space-y-2 border-t border-cream-300/80 px-3 py-2.5">
          <p className="text-[11px] leading-snug text-cream-600">{t("list.filtersPanelHint")}</p>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-6 md:gap-x-2 md:gap-y-2">
            <div className="col-span-2 min-w-0 md:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-cream-700" htmlFor="list-filter-category">
                {t("list.filterCategory")}
              </label>
              <select
                id="list-filter-category"
                className="sk-select !min-h-9 w-full py-1.5 text-sm"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
              >
                <option value="">{t("common.all")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 min-w-0 md:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-cream-700" htmlFor="list-filter-currency">
                {t("list.filterCurrency")}
              </label>
              <select
                id="list-filter-currency"
                className="sk-select !min-h-9 w-full py-1.5 text-sm"
                value={curFilter}
                onChange={(e) => setCurFilter(e.target.value)}
              >
                <option value="">{t("common.all")}</option>
                {currencyOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-end md:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-cream-400/70 bg-cream-100/35 px-2.5 py-2 text-xs text-cream-800">
                <input
                  type="checkbox"
                  id="due-soon"
                  className="size-3.5 shrink-0 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                  checked={dueSoon}
                  onChange={(e) => setDueSoon(e.target.checked)}
                />
                <span className="leading-snug">{t("list.dueSoon")}</span>
              </label>
            </div>

            <div className="col-span-2 min-w-0 md:col-span-6">
              <label className="mb-0.5 block text-xs font-medium text-cream-700" htmlFor="list-search">
                {t("common.search")}
              </label>
              <input
                ref={searchRef}
                id="list-search"
                className="sk-input !min-h-9 w-full py-1.5 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => {
                  if (filterDetailsRef.current) filterDetailsRef.current.open = true;
                }}
                placeholder={t("list.searchPlaceholder")}
                autoComplete="off"
              />
              <p className="mt-0.5 text-[10px] text-cream-500">{t("list.searchSlashHint")}</p>
            </div>

            <div className="col-span-2 min-w-0 md:col-span-3">
              <label className="mb-0.5 block text-xs font-medium text-cream-700" htmlFor="list-sort-key">
                {t("list.sortBy")}
              </label>
              <select
                id="list-sort-key"
                className="sk-select !min-h-9 min-w-0 w-full py-1.5 text-sm"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="next_due">{t("list.sort.nextDue")}</option>
                <option value="title">{t("list.sort.title")}</option>
                <option value="category">{t("list.sort.category")}</option>
                <option value="amount">{t("list.sort.amount")}</option>
                <option value="primary">{t("list.sort.primary")}</option>
              </select>
            </div>
            <div className="col-span-2 min-w-0 md:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-cream-700" htmlFor="list-sort-dir">
                {t("list.sortDirectionShort")}
              </label>
              <select
                id="list-sort-dir"
                className="sk-select !min-h-9 w-full py-1.5 text-sm"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
              >
                <option value="asc">{t("list.sort.asc")}</option>
                <option value="desc">{t("list.sort.desc")}</option>
              </select>
            </div>
            <div className="col-span-2 flex items-end md:col-span-1 md:justify-end">
              <button
                type="button"
                className="sk-btn-secondary !min-h-9 w-full px-3 py-1.5 text-xs md:w-auto"
                onClick={() => void reload()}
              >
                {t("list.applyFilters")}
              </button>
            </div>
          </div>
        </div>
      </details>

      {loading ? (
        <p className="sk-text-hint">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="sk-text-hint">{t("list.empty")}</p>
      ) : (
        <div className="sk-card overflow-x-auto p-0 shadow-sm">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="border-b border-cream-400 bg-cream-200/80 text-cream-800">
              <tr>
                <th className="px-3 py-3 font-semibold">{t("list.name")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.category")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.billingAndPeriod")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.nextDue")}</th>
                <th className="px-3 py-3 font-semibold">
                  {t("list.amountAndApprox", { code: primaryCode })}
                </th>
                <th className="px-3 py-3 font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((s) => {
                const prog = computeDueProgress(progressInput(s));
                const tone = prog ? dueProgressTone(prog) : null;
                const rowTint = tone ? dueListRowHighlightClass(tone) : "";
                return (
                  <tr
                    key={s.id}
                    className={`cursor-pointer border-t border-cream-300/80 hover:bg-cream-200/40 ${rowTint}`}
                    onClick={() => nav(`/sub/${s.id}`)}
                  >
                    <td className="px-3 py-3 align-top">
                      <div className="flex w-full items-start justify-start gap-2">
                        {s.website_url?.trim() ? (
                          <SiteFavicon websiteUrl={s.website_url} size="sm" className="mt-0.5 shrink-0" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/sub/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-cream-950 underline-offset-2 hover:underline"
                          >
                            {s.title}
                          </Link>
                          {s.account_label?.trim() ? (
                            <span className="mt-0.5 block text-xs text-cream-600">{s.account_label.trim()}</span>
                          ) : null}
                        </div>
                      </div>
                      {s.next_due_date ? (
                        <div className="mt-2">
                          <DueProgressBar sub={progressInput(s)} size="sm" showCaption={false} />
                        </div>
                      ) : (
                        <span className="mt-1 block text-xs text-cream-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-cream-800">{s.category_name ?? "—"}</td>
                    <td className="px-3 py-3 text-cream-800">{billingCell(s)}</td>
                    <td className="px-3 py-3 text-cream-800">
                      {s.next_due_date ?? "—"}
                      {prog && tone ? (
                        <span className={`mt-0.5 block text-xs font-medium ${toneTextClass(tone)}`}>
                          {relativeDueCaption(t, prog)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <DualCurrencyAmounts
                        size="sm"
                        originalAmount={s.amount_original}
                        originalCode={s.currency_code}
                        approxAmount={s.amount_qar_snapshot}
                        approxCode={primaryCode}
                      />
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/sub/${s.id}/edit`}
                        className="text-walnut-600 underline-offset-2 hover:underline"
                      >
                        {t("common.edit")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
