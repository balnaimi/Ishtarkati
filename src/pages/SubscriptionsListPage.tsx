import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loadSubscriptions,
  loadCategories,
  getSetting,
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
import { tagTokens } from "../lib/tags";

function toneTextClass(tone: DueTone): string {
  if (tone === "overdue" || tone === "due") return "text-red-800";
  if (tone === "urgent") return "text-orange-900";
  if (tone === "warn") return "text-amber-900";
  return "text-sage-800";
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
    let cancelled = false;
    void (async () => {
      const on = await getSetting("reminders_enabled");
      if (cancelled || on !== "1") return;
      const today = new Date().toISOString().slice(0, 10);
      const key = `due_digest_${today}`;
      if (sessionStorage.getItem(key)) return;
      const near = await loadSubscriptions({ dueWithinDays: 7 });
      const n = near.filter((s) => s.next_due_date).length;
      if (n === 0) return;
      const ok = await window.ishtarkati.showNotification({
        title: t("notify.digestTitle"),
        body: t("notify.digestBody", { count: n }),
      });
      if (ok) sessionStorage.setItem(key, "1");
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function billingLabel(model: string) {
    if (model === "one_time") return t("billing.one_time");
    return t("billing.recurring");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-cream-900">{t("list.title")}</h2>
        <Link to="/" className="text-sm font-medium text-sage-800 underline-offset-2 hover:underline">
          ← {t("home.dashboardTitle")}
        </Link>
      </div>

      <div className="sk-card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <label className="sk-label">{t("list.filterCategory")}</label>
            <select
              className="sk-select"
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
          <div className="lg:col-span-2">
            <label className="sk-label">{t("list.filterCurrency")}</label>
            <select
              className="sk-select"
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
          <div className="flex items-center gap-2.5 lg:col-span-3">
            <input
              type="checkbox"
              id="due-soon"
              className="size-4 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
              checked={dueSoon}
              onChange={(e) => setDueSoon(e.target.checked)}
            />
            <label htmlFor="due-soon" className="cursor-pointer text-sm text-cream-800">
              {t("list.dueSoon")}
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="sk-label">{t("common.search")}</label>
            <input
              ref={searchRef}
              id="list-search"
              className="sk-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("list.searchPlaceholder")}
              autoComplete="off"
            />
          </div>
          <div className="flex lg:col-span-1">
            <button type="button" className="sk-btn-secondary w-full lg:w-auto" onClick={() => void reload()}>
              {t("list.applyFilters")}
            </button>
          </div>
          <div className="lg:col-span-4">
            <label className="sk-label">{t("list.sortBy")}</label>
            <div className="flex flex-wrap gap-2">
              <select
                className="sk-select min-w-0 flex-1 sm:max-w-[14rem]"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="next_due">{t("list.sort.nextDue")}</option>
                <option value="title">{t("list.sort.title")}</option>
                <option value="category">{t("list.sort.category")}</option>
                <option value="amount">{t("list.sort.amount")}</option>
                <option value="primary">{t("list.sort.primary")}</option>
              </select>
              <select
                className="sk-select w-full sm:w-36"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
              >
                <option value="asc">{t("list.sort.asc")}</option>
                <option value="desc">{t("list.sort.desc")}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-cream-700">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-cream-700">{t("list.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream-400 bg-cream-50/95 shadow-sm">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="border-b border-cream-400 bg-cream-200/80 text-cream-800">
              <tr>
                <th className="px-3 py-3 font-semibold">{t("list.name")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.category")}</th>
                <th className="px-3 py-3 font-semibold">{t("list.billing")}</th>
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
                      <div className="flex items-start justify-end gap-2">
                        {s.website_url?.trim() ? (
                          <SiteFavicon websiteUrl={s.website_url} size="sm" className="mt-0.5 shrink-0" />
                        ) : null}
                        <Link
                          to={`/sub/${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 font-medium text-sage-800 underline-offset-2 hover:underline"
                        >
                          {s.title}
                        </Link>
                      </div>
                      {tagTokens(s.tags).length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {tagTokens(s.tags).map((tag) => (
                            <span key={`${s.id}-${tag}`} className="inline-block sk-chip text-[10px] leading-tight">
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {s.next_due_date ? (
                        <div className="mt-2">
                          <DueProgressBar sub={progressInput(s)} size="sm" showCaption={false} />
                        </div>
                      ) : (
                        <span className="mt-1 block text-xs text-cream-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-cream-800">{s.category_name ?? "—"}</td>
                    <td className="px-3 py-3 text-cream-800">{billingLabel(s.billing_model)}</td>
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
