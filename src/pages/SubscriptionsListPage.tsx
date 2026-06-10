import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  confirmSubscriptionPaid,
  loadAllAccountEmails,
  loadDistinctSubscriptionCurrencies,
  loadSubscriptions,
  loadCategories,
  getPrimaryCurrencyCode,
  subscriptionNeedsPaidAttention,
  type AppCurrency,
  type SubscriptionListRow,
} from "../db/repo";
import { useFxManager } from "../hooks/useFx";
import { CancelledAccountsTab } from "../components/CancelledAccountsTab";
import { DueProgressBar } from "../components/DueProgressBar";
import { DualCurrencyAmounts } from "../components/DualCurrencyAmounts";
import { SiteFavicon } from "../components/SiteFavicon";
import {
  computeDueProgress,
  dueListRowHighlightClass,
  dueToneTextClass,
  dueProgressTone,
  relativeDueCaption,
  type DueProgressInput,
} from "../lib/dueProgress";
import { subscriptionBillingPeriodLine } from "../lib/billingPeriodLabel";
import {
  accountPaymentStatus,
  accountPaymentStatusI18nKey,
  billingModelI18nKey,
  isFreeAccount,
  type RecordKindFilter,
} from "../lib/subscriptionKind";

type SortKey = "next_due" | "title" | "category" | "amount" | "primary";
type PageTab = "active" | "deleted";

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

function payBadgeClass(status: ReturnType<typeof accountPaymentStatus>): string {
  if (status === "free") return "bg-cream-200/90 text-cream-800";
  if (status === "one_time") return "bg-walnut-100/90 text-walnut-800";
  return "bg-sage-100/90 text-sage-900";
}

/** Unified accounts list — table with due progress (formerly «كل السجلات» + «حساباتي»). */
export function SubscriptionsListPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageTab: PageTab = searchParams.get("tab") === "deleted" ? "deleted" : "active";

  const searchRef = useRef<HTMLInputElement>(null);
  const filterDetailsRef = useRef<HTMLDetailsElement>(null);
  const [items, setItems] = useState<SubscriptionListRow[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<AppCurrency[]>([]);
  const [emails, setEmails] = useState<{ email: string; count: number }[]>([]);
  const [primaryCode, setPrimaryCode] = useState("QAR");
  const [catFilter, setCatFilter] = useState("");
  const [curFilter, setCurFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [dueSoon, setDueSoon] = useState(false);
  const [recordKind, setRecordKind] = useState<RecordKindFilter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortKey, setSortKey] = useState<SortKey>("next_due");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const { hydrate } = useFxManager();

  const reload = useCallback(async () => {
    if (pageTab !== "active") return;
    setLoading(true);
    try {
      const q = deferredSearch.trim();
      const [list, cats, curs, prim, mailRows] = await Promise.all([
        loadSubscriptions({
          categoryId: catFilter ? parseInt(catFilter, 10) : undefined,
          currency: curFilter || undefined,
          dueWithinDays: dueSoon ? 30 : undefined,
          recordKind,
          search: q || undefined,
        }),
        loadCategories(),
        loadDistinctSubscriptionCurrencies().then((codes) =>
          codes.map((code, i) => ({ code, sort_order: i })),
        ),
        getPrimaryCurrencyCode(),
        loadAllAccountEmails(),
      ]);
      setItems(list);
      setCategories(cats);
      setCurrencyOptions(curs);
      setPrimaryCode(prim);
      setEmails(mailRows);
    } finally {
      setLoading(false);
    }
  }, [catFilter, curFilter, dueSoon, recordKind, deferredSearch, pageTab]);

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

  const displayedItems = useMemo(() => {
    if (!emailFilter.trim()) return sortedItems;
    const needle = emailFilter.trim().toLowerCase();
    return sortedItems.filter((s) => (s.account_label ?? "").trim().toLowerCase() === needle);
  }, [sortedItems, emailFilter]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

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
        /* ignore */
      }
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      e.preventDefault();
      if (filterDetailsRef.current) filterDetailsRef.current.open = true;
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function billingLabel(model: string) {
    return t(billingModelI18nKey(model));
  }

  function payDueCell(s: SubscriptionListRow) {
    const free = isFreeAccount(s);
    if (free) {
      const status = accountPaymentStatus(s);
      return (
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${payBadgeClass(status)}`}
        >
          {t(accountPaymentStatusI18nKey(status))}
        </span>
      );
    }
    const period = subscriptionBillingPeriodLine(s, t);
    const prog = computeDueProgress(progressInput(s));
    const tone = prog ? dueProgressTone(prog) : null;
    return (
      <div className="space-y-0.5">
        <span className="block font-medium">{billingLabel(s.billing_model)}</span>
        {period ? <span className="block text-xs text-cream-600">{period}</span> : null}
        <span className="block text-cream-800">{s.next_due_date ?? "—"}</span>
        {prog && tone ? (
          <span className={`block text-xs font-medium ${dueToneTextClass(tone)}`}>
            {relativeDueCaption(t, prog)}
          </span>
        ) : null}
      </div>
    );
  }

  function setPageTab(tab: PageTab) {
    if (tab === "deleted") {
      setSearchParams({ tab: "deleted" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-cream-900">{t("accounts.title")}</h2>
          <p className="sk-text-hint mt-1 text-sm">{t("accounts.subtitle")}</p>
        </div>
        {pageTab === "active" ? (
          <Link to="/new" className="sk-btn-warm px-4 py-2.5 text-sm font-semibold">
            {t("accounts.addCta")}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-cream-400/70 pb-1">
        {(
          [
            ["active", t("accounts.tabActive")] as const,
            ["deleted", t("accounts.tabDeleted")] as const,
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              pageTab === id
                ? "bg-cream-800 text-cream-50"
                : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
            }`}
            onClick={() => setPageTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pageTab === "deleted" ? (
        <div className="space-y-3">
          <p className="text-sm text-cream-700">{t("cancelled.subtitle")}</p>
          <CancelledAccountsTab />
        </div>
      ) : (
        <>
          <details ref={filterDetailsRef} className="sk-card overflow-hidden p-0 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-cream-900 outline-none transition-colors hover:bg-cream-200/30 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-cream-500" aria-hidden>
                  ▾
                </span>
                <span className="truncate">{t("list.filtersToggle")}</span>
              </span>
            </summary>

            <div className="space-y-2 border-t border-cream-300/80 px-3 py-2.5">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6 md:gap-x-2 md:gap-y-2">
                <div className="col-span-2 min-w-0 md:col-span-6">
                  <span className="mb-1 block text-xs font-medium text-cream-700">
                    {t("list.recordKind")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["all", t("list.recordKindAll")] as const,
                        ["paid", t("list.recordKindPaid")] as const,
                        ["free", t("list.recordKindFree")] as const,
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          recordKind === id
                            ? "bg-cream-800 text-cream-50"
                            : "bg-cream-200/70 text-cream-900 hover:bg-cream-300"
                        }`}
                        onClick={() => setRecordKind(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 min-w-0 md:col-span-2">
                  <label
                    className="mb-0.5 block text-xs font-medium text-cream-700"
                    htmlFor="list-search"
                  >
                    {t("common.search")}
                  </label>
                  <input
                    ref={searchRef}
                    id="list-search"
                    className="sk-input !min-h-9 w-full py-1.5 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("accounts.searchPlaceholder")}
                    autoComplete="off"
                  />
                </div>

                <div className="col-span-2 min-w-0 md:col-span-2">
                  <label
                    className="mb-0.5 block text-xs font-medium text-cream-700"
                    htmlFor="list-email-filter"
                  >
                    {t("accounts.filterByEmail")}
                  </label>
                  <select
                    id="list-email-filter"
                    className="sk-select !min-h-9 w-full py-1.5 text-sm"
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                  >
                    <option value="">{t("accounts.allEmails")}</option>
                    {emails.map((row) => (
                      <option key={row.email} value={row.email}>
                        {row.email} ({row.count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 min-w-0 md:col-span-2">
                  <label
                    className="mb-0.5 block text-xs font-medium text-cream-700"
                    htmlFor="list-filter-category"
                  >
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
                  <label
                    className="mb-0.5 block text-xs font-medium text-cream-700"
                    htmlFor="list-filter-currency"
                  >
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
                      className="size-3.5 shrink-0 rounded border-cream-500 text-sage-600 focus:ring-sage-500"
                      checked={dueSoon}
                      onChange={(e) => setDueSoon(e.target.checked)}
                    />
                    <span className="leading-snug">{t("list.dueSoon")}</span>
                  </label>
                </div>

                <div className="col-span-2 min-w-0 md:col-span-3">
                  <label
                    className="mb-0.5 block text-xs font-medium text-cream-700"
                    htmlFor="list-sort-key"
                  >
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
                <div className="col-span-2 min-w-0 md:col-span-3">
                  <label
                    className="mb-0.5 block text-xs font-medium text-cream-700"
                    htmlFor="list-sort-dir"
                  >
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
              </div>
            </div>
          </details>

          {loading ? (
            <p className="sk-text-hint">{t("common.loading")}</p>
          ) : displayedItems.length === 0 ? (
            <p className="sk-text-hint">
              {items.length === 0 ? t("accounts.empty") : t("accounts.noSearchResults")}
            </p>
          ) : (
            <div className="sk-card overflow-x-auto p-0 shadow-sm">
              <table className="w-full min-w-[520px] text-start text-sm">
                <thead className="border-b border-cream-400 bg-cream-200/80 text-cream-800">
                  <tr>
                    <th className="px-3 py-3 font-semibold">{t("list.colAccount")}</th>
                    <th className="px-3 py-3 font-semibold">{t("list.colPayDue")}</th>
                    <th className="px-3 py-3 font-semibold">
                      {t("list.amountAndApprox", { code: primaryCode })}
                    </th>
                    <th className="px-3 py-3 font-semibold">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((s) => {
                    const free = isFreeAccount(s);
                    const prog = free ? null : computeDueProgress(progressInput(s));
                    const tone = prog ? dueProgressTone(prog) : null;
                    const needsPaid = subscriptionNeedsPaidAttention(s);
                    const rowTint = tone ? dueListRowHighlightClass(tone) : "";
                    return (
                      <tr
                        key={s.id}
                        className={`cursor-pointer border-t border-cream-300/80 hover:bg-cream-200/40 ${needsPaid ? "sk-ring-needs-pay" : ""} ${rowTint}`.trim()}
                        onClick={() => nav(`/sub/${s.id}`)}
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="flex w-full items-start justify-start gap-2">
                            {s.website_url?.trim() ? (
                              <SiteFavicon
                                websiteUrl={s.website_url}
                                size="sm"
                                className="mt-0.5 shrink-0"
                              />
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
                                <button
                                  type="button"
                                  dir="ltr"
                                  className="mt-0.5 block text-start text-xs text-sage-800 underline-offset-2 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEmailFilter(s.account_label!.trim());
                                    if (filterDetailsRef.current) filterDetailsRef.current.open = true;
                                  }}
                                >
                                  {s.account_label.trim()}
                                </button>
                              ) : null}
                              {s.category_name ? (
                                <span className="mt-0.5 block text-xs text-cream-500">
                                  {s.category_name}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {free ? (
                            s.notes?.trim() ? (
                              <span className="mt-1 block line-clamp-2 text-xs text-cream-600">
                                {s.notes.trim()}
                              </span>
                            ) : null
                          ) : s.next_due_date ? (
                            <div className="mt-2">
                              <DueProgressBar sub={progressInput(s)} size="sm" showCaption={false} />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-cream-800">{payDueCell(s)}</td>
                        <td className="px-3 py-3 align-top">
                          {free ? (
                            <span className="text-cream-500">—</span>
                          ) : (
                            <DualCurrencyAmounts
                              size="sm"
                              originalAmount={s.amount_original}
                              originalCode={s.currency_code}
                              approxAmount={s.amount_qar_snapshot}
                              approxCode={primaryCode}
                            />
                          )}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap gap-2">
                            {needsPaid ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-md bg-sage-600 px-2 py-1 text-xs font-medium text-cream-50 transition-colors hover:bg-sage-700"
                                onClick={(e) => void onConfirmPaid(e, s.id)}
                              >
                                {t("home.markPaid")}
                              </button>
                            ) : null}
                            <Link
                              to={`/sub/${s.id}/edit`}
                              className="inline-flex items-center text-walnut-600 underline-offset-2 hover:underline"
                            >
                              {t("common.edit")}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
