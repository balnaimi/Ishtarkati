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
import { formatUiError } from "../lib/uiErrors";
import { useFxManager } from "../hooks/useFx";
import { IconChevron, IconPlus, IconSearch } from "../components/NavIcons";
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
type StatusChip = "all" | "dueSoon" | "overdue";

function categoryTagClass(categoryId: number | null | undefined): string {
  if (categoryId == null) return "dash-tag-violet";
  const classes = ["dash-tag-violet", "dash-tag-blue", "dash-tag-teal"] as const;
  return classes[categoryId % classes.length];
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

function payBadgeClass(status: ReturnType<typeof accountPaymentStatus>): string {
  if (status === "free") return "bg-cream-200/90 text-cream-800";
  if (status === "one_time") return "bg-walnut-100/90 text-walnut-800";
  return "bg-sage-100/90 text-sage-900";
}

/** Unified accounts list with due progress bar. */
export function SubscriptionsListPage() {
  const { t, i18n } = useTranslation();
  const collatorLocale = i18n.language === "en" ? "en" : "ar";
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
  const [statusChip, setStatusChip] = useState<StatusChip>("all");
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
          return a.title.localeCompare(b.title, collatorLocale) * mul;
        case "category":
          return (a.category_name ?? "").localeCompare(b.category_name ?? "", collatorLocale) * mul;
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

  const visibleItems = useMemo(() => {
    if (statusChip !== "overdue") return displayedItems;
    return displayedItems.filter((s) => {
      if (isFreeAccount(s) || !s.next_due_date) return false;
      const prog = computeDueProgress(progressInput(s));
      if (!prog) return false;
      const tone = dueProgressTone(prog);
      return tone === "overdue" || tone === "due";
    });
  }, [displayedItems, statusChip]);

  const listSummary = useMemo(() => {
    let dueSoonCount = 0;
    let overdueCount = 0;
    let monthlyApprox = 0;
    for (const s of visibleItems) {
      if (!isFreeAccount(s)) monthlyApprox += s.amount_qar_snapshot ?? 0;
      if (isFreeAccount(s) || !s.next_due_date) continue;
      const prog = computeDueProgress(progressInput(s));
      if (!prog) continue;
      const tone = dueProgressTone(prog);
      if (tone === "overdue" || tone === "due") overdueCount += 1;
      else if (tone === "urgent" || tone === "warn") dueSoonCount += 1;
    }
    return { dueSoonCount, overdueCount, monthlyApprox, active: visibleItems.length };
  }, [visibleItems]);

  useEffect(() => {
    setDueSoon(statusChip === "dueSoon");
  }, [statusChip]);

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
      const detail = formatUiError(t, err);
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

  function setPageTab(tab: PageTab) {
    if (tab === "deleted") {
      setSearchParams({ tab: "deleted" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="dash-page-title">{t("accounts.title")}</h1>
          <p className="dash-page-sub">{t("accounts.subtitle")}</p>
        </div>
        {pageTab === "active" ? (
          <Link to="/new" className="dash-btn-primary no-underline">
            <IconPlus className="size-4" />
            {t("accounts.addCta")}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["active", t("accounts.tabActive")] as const,
            ["deleted", t("accounts.tabDeleted")] as const,
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`dash-chip ${pageTab === id ? "dash-chip-active" : "dash-chip-idle"}`}
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="dash-search max-w-xl flex-1">
              <IconSearch className="size-4 shrink-0 text-cream-600" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("accounts.searchPlaceholder")}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", t("list.filterStatusAll")] as const,
                  ["dueSoon", t("list.filterStatusDueSoon")] as const,
                  ["overdue", t("list.filterStatusOverdue")] as const,
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`dash-chip ${statusChip === id ? "dash-chip-active" : "dash-chip-idle"}`}
                  onClick={() => setStatusChip(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <details ref={filterDetailsRef} className="dash-card overflow-hidden p-0">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-cream-800 [&::-webkit-details-marker]:hidden">
              {t("list.filtersToggle")}
            </summary>
            <div className="grid gap-3 border-t border-cream-400/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="sk-label" htmlFor="list-email-filter">
                  {t("accounts.filterByEmail")}
                </label>
                <select
                  id="list-email-filter"
                  className="sk-select !min-h-9 text-sm"
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

              <div>
                <label className="sk-label" htmlFor="list-filter-category">
                  {t("list.filterCategory")}
                </label>
                <select
                  id="list-filter-category"
                  className="sk-select !min-h-9 text-sm"
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
              <div>
                <label className="sk-label" htmlFor="list-filter-currency">
                  {t("list.filterCurrency")}
                </label>
                <select
                  id="list-filter-currency"
                  className="sk-select !min-h-9 text-sm"
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
              <div>
                <span className="sk-label">{t("list.recordKind")}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
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
                      className={`dash-chip ${recordKind === id ? "dash-chip-active" : "dash-chip-idle"}`}
                      onClick={() => setRecordKind(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="sk-label" htmlFor="list-sort-key">
                  {t("list.sortBy")}
                </label>
                <select
                  id="list-sort-key"
                  className="sk-select !min-h-9 text-sm"
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
              <div>
                <label className="sk-label" htmlFor="list-sort-dir">
                  {t("list.sortDirectionShort")}
                </label>
                <select
                  id="list-sort-dir"
                  className="sk-select !min-h-9 text-sm"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                >
                  <option value="asc">{t("list.sort.asc")}</option>
                  <option value="desc">{t("list.sort.desc")}</option>
                </select>
              </div>
            </div>
          </details>

          {loading ? (
            <p className="sk-text-hint">{t("common.loading")}</p>
          ) : visibleItems.length === 0 ? (
            <p className="sk-text-hint">
              {items.length === 0 ? t("accounts.empty") : t("accounts.noSearchResults")}
            </p>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((s) => {
                const free = isFreeAccount(s);
                const prog = free ? null : computeDueProgress(progressInput(s));
                const tone = prog ? dueProgressTone(prog) : null;
                const needsPaid = subscriptionNeedsPaidAttention(s);
                const tagClass = categoryTagClass(s.category_id);
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    className={`dash-sub-row cursor-pointer md:grid-cols-[minmax(0,1.6fr)_auto_auto_auto_auto] md:items-center ${needsPaid ? "sk-ring-needs-pay" : ""} ${tone ? dueListRowHighlightClass(tone) : ""}`.trim()}
                    onClick={() => nav(`/sub/${s.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        nav(`/sub/${s.id}`);
                      }
                    }}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      {s.website_url?.trim() ? (
                        <SiteFavicon websiteUrl={s.website_url} size="sm" className="mt-0.5 shrink-0" />
                      ) : (
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-cream-300/40 text-xs font-bold text-cream-700">
                          {s.title.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-cream-950">{s.title}</div>
                        {s.account_label?.trim() ? (
                          <button
                            type="button"
                            dir="ltr"
                            className="mt-0.5 block text-start text-xs text-cream-600 underline-offset-2 hover:underline"
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
                          <span className={`dash-tag mt-2 ${tagClass}`}>{s.category_name}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-sm text-cream-700 md:text-center">
                      {free ? (
                        <span className={`dash-tag ${payBadgeClass(accountPaymentStatus(s))}`}>
                          {t(accountPaymentStatusI18nKey(accountPaymentStatus(s)))}
                        </span>
                      ) : (
                        <>
                          <div className="font-medium text-cream-900">{billingLabel(s.billing_model)}</div>
                          {subscriptionBillingPeriodLine(s, t) ? (
                            <div className="text-xs text-cream-600">{subscriptionBillingPeriodLine(s, t)}</div>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div className="md:text-center">
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
                    </div>

                    <div className="min-w-0 md:max-w-[10rem]">
                      {free ? null : s.next_due_date ? (
                        <>
                          <div className="text-sm font-medium text-cream-900">{s.next_due_date}</div>
                          {prog && tone ? (
                            <div className={`text-xs font-medium ${dueToneTextClass(tone)}`}>
                              {relativeDueCaption(t, prog)}
                            </div>
                          ) : null}
                          <div className="mt-2">
                            <DueProgressBar sub={progressInput(s)} size="sm" showCaption={false} />
                          </div>
                        </>
                      ) : (
                        <span className="text-cream-500">—</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 md:justify-end">
                      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {needsPaid ? (
                          <button
                            type="button"
                            className="dash-btn-primary !min-h-8 px-3 py-1 text-xs"
                            onClick={(e) => void onConfirmPaid(e, s.id)}
                          >
                            {t("home.markPaid")}
                          </button>
                        ) : free || !tone || tone === "safe" ? (
                          <span className="dash-status-active">
                            <span className="size-1.5 rounded-full bg-sage-400" aria-hidden />
                            {t("list.summaryActive")}
                          </span>
                        ) : tone === "overdue" || tone === "due" ? (
                          <span className="dash-status-danger">
                            <span className="size-1.5 rounded-full bg-brand-danger" aria-hidden />
                            {t("list.summaryOverdue")}
                          </span>
                        ) : (
                          <span className="dash-status-warn">
                            <span className="size-1.5 rounded-full bg-brand-warn" aria-hidden />
                            {t("list.summaryDueSoon")}
                          </span>
                        )}
                      </div>
                      <IconChevron className="size-5 shrink-0 text-cream-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pageTab === "active" && !loading && visibleItems.length > 0 ? (
            <div className="dash-summary-bar">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  <span className="sk-text-hint">{t("list.summaryActive")}: </span>
                  <span className="font-semibold text-cream-950">{listSummary.active}</span>
                </span>
                <span>
                  <span className="sk-text-hint">{t("list.summaryDueSoon")}: </span>
                  <span className="font-semibold dash-text-warn">{listSummary.dueSoonCount}</span>
                </span>
                <span>
                  <span className="sk-text-hint">{t("list.summaryOverdue")}: </span>
                  <span className="font-semibold text-brand-danger">{listSummary.overdueCount}</span>
                </span>
              </div>
              <div className="text-end">
                <div className="text-xs sk-text-hint">{t("list.summaryMonthly")}</div>
                <div className="text-lg font-bold text-cream-950">
                  {listSummary.monthlyApprox.toFixed(2)} {primaryCode}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
